from __future__ import annotations

import json
import os
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

from .ids import source_item_id
from .substack import FeedItem, Publication, fetch_feed


def discover_creator(
    creator: dict[str, Any],
    *,
    source_items: Any,
    queue: Any,
    queue_url: str,
    feed_loader: Callable[[Publication], tuple[str, list[FeedItem]]] = fetch_feed,
    item_limit: int = 20,
) -> int:
    publication = Publication(
        display_name=creator["displayName"],
        site_url=creator["siteUrl"],
        feed_url=creator["feedUrl"],
    )
    _display_name, posts = feed_loader(publication)
    queued = 0
    for post in posts[:item_limit]:
        identifier = source_item_id(post.guid or post.url)
        item = {
            "sourceItemId": identifier,
            "creatorId": creator["creatorId"],
            "sourceUrl": post.url,
            "sourceGuid": post.guid,
            "title": post.title,
            "publishedAt": post.published_at,
            "status": "QUEUED",
            "attemptCount": 0,
            "discoveredAt": datetime.now(UTC).isoformat(),
        }
        if post.image_url:
            item["image"] = post.image_url
        try:
            source_items.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(sourceItemId)",
            )
        except ClientError as exc:
            if (
                exc.response.get("Error", {}).get("Code")
                == "ConditionalCheckFailedException"
            ):
                continue
            raise
        queue.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"sourceItemId": identifier}),
        )
        queued += 1
    return queued


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    dynamodb = boto3.resource("dynamodb")
    creators = dynamodb.Table(os.environ["CREATORS_TABLE"])
    source_items = dynamodb.Table(os.environ["SOURCE_ITEMS_TABLE"])
    queue = boto3.client("sqs")
    identifier = event.get("creatorId")
    if identifier:
        creator = creators.get_item(Key={"creatorId": identifier}).get("Item")
        creator_rows = [creator] if creator else []
    else:
        creator_rows = creators.scan(
            FilterExpression="#status = :active",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":active": "ACTIVE"},
        ).get("Items", [])

    queued = 0
    for creator in creator_rows:
        now = datetime.now(UTC).isoformat()
        try:
            queued += discover_creator(
                creator,
                source_items=source_items,
                queue=queue,
                queue_url=os.environ["EXTRACTION_QUEUE_URL"],
                item_limit=int(os.getenv("INITIAL_IMPORT_LIMIT", "20")),
            )
            creators.update_item(
                Key={"creatorId": creator["creatorId"]},
                UpdateExpression=(
                    "SET lastCheckedAt = :now, lastSuccessfulCheckAt = :now "
                    "REMOVE lastError"
                ),
                ExpressionAttributeValues={":now": now},
            )
        except Exception as exc:
            creators.update_item(
                Key={"creatorId": creator["creatorId"]},
                UpdateExpression="SET lastCheckedAt = :now, lastError = :error",
                ExpressionAttributeValues={":now": now, ":error": str(exc)[:500]},
            )
            raise
    return {"queued": queued, "creatorsChecked": len(creator_rows)}
