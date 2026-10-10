from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

from .aws_utils import to_dynamo
from .bedrock import RecipeExtractor
from .ids import recipe_id
from .models import ExtractionMessage, ExtractionResult
from .substack import fetch_article_text

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def process_source_item(
    source_id: str,
    *,
    source_items: Any,
    recipes: Any,
    extractor: RecipeExtractor,
    article_loader: Callable[[str], str] = fetch_article_text,
) -> int:
    source = source_items.get_item(Key={"sourceItemId": source_id}).get("Item")
    if not source:
        raise KeyError(f"Source item {source_id} does not exist.")
    if source.get("status") in {"COMPLETE", "NO_RECIPE"}:
        return 0

    source_items.update_item(
        Key={"sourceItemId": source_id},
        UpdateExpression="SET #status = :processing ADD attemptCount :one",
        ConditionExpression="#status IN (:queued, :failed)",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":processing": "PROCESSING",
            ":queued": "QUEUED",
            ":failed": "FAILED",
            ":one": 1,
        },
    )
    try:
        article = article_loader(source["sourceUrl"])
        if not article.strip():
            result = ExtractionResult()
        else:
            result = extractor.extract(source["title"], article)
        now = datetime.now(UTC).isoformat()
        for index, recipe in enumerate(result.recipes):
            item = {
                "recipeId": recipe_id(source_id, index),
                "sourceItemId": source_id,
                "creatorId": source["creatorId"],
                "sourceUrl": source["sourceUrl"],
                "publishedAt": source["publishedAt"],
                "createdAt": now,
                **recipe.model_dump(),
            }
            if source.get("image"):
                item["image"] = source["image"]
            try:
                recipes.put_item(
                    Item=to_dynamo(item),
                    ConditionExpression="attribute_not_exists(recipeId)",
                )
            except ClientError as exc:
                if (
                    exc.response.get("Error", {}).get("Code")
                    != "ConditionalCheckFailedException"
                ):
                    raise
        final_status = "COMPLETE" if result.recipes else "NO_RECIPE"
        source_items.update_item(
            Key={"sourceItemId": source_id},
            UpdateExpression="SET #status = :status, completedAt = :now REMOVE errorCode",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": final_status, ":now": now},
        )
        return len(result.recipes)
    except Exception as exc:
        source_items.update_item(
            Key={"sourceItemId": source_id},
            UpdateExpression="SET #status = :failed, errorCode = :error",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":failed": "FAILED", ":error": str(exc)[:500]},
        )
        raise


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    dynamodb = boto3.resource("dynamodb")
    source_items = dynamodb.Table(os.environ["SOURCE_ITEMS_TABLE"])
    recipes = dynamodb.Table(os.environ["RECIPES_TABLE"])
    extractor = RecipeExtractor()
    failures = []
    for record in event.get("Records", []):
        try:
            message = ExtractionMessage.model_validate(json.loads(record["body"]))
            process_source_item(
                message.sourceItemId,
                source_items=source_items,
                recipes=recipes,
                extractor=extractor,
            )
        except Exception:
            logger.exception(
                "Recipe extraction failed",
                extra={"messageId": record.get("messageId", "unknown")},
            )
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
