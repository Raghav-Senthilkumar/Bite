from __future__ import annotations

import json
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from .aws_utils import from_dynamo
from .ids import creator_id
from .substack import Publication, SubstackError, canonicalize_publication, fetch_feed


def _now() -> datetime:
    return datetime.now(UTC)


def _response(status: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(from_dynamo(body)),
    }


def _user_id(event: dict[str, Any]) -> str:
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    user_id = claims.get("sub")
    if not user_id:
        raise PermissionError("Missing authenticated user identity.")
    return str(user_id)


class ApiService:
    def __init__(
        self,
        *,
        users: Any,
        creators: Any,
        follows: Any,
        source_items: Any,
        recipes: Any,
        lambda_client: Any,
        discovery_function_name: str,
        feed_loader: Callable[[Publication], tuple[str, list[Any]]] = fetch_feed,
    ) -> None:
        self.users = users
        self.creators = creators
        self.follows = follows
        self.source_items = source_items
        self.recipes = recipes
        self.lambda_client = lambda_client
        self.discovery_function_name = discovery_function_name
        self.feed_loader = feed_loader

    def me(self, user_id: str, claims: dict[str, Any]) -> dict[str, Any]:
        now = _now().isoformat()
        self.users.update_item(
            Key={"userId": user_id},
            UpdateExpression=(
                "SET email = if_not_exists(email, :email), "
                "displayName = if_not_exists(displayName, :name), "
                "createdAt = if_not_exists(createdAt, :now), updatedAt = :now"
            ),
            ExpressionAttributeValues={
                ":email": claims.get("email", ""),
                ":name": claims.get("name") or claims.get("email", "Bite cook"),
                ":now": now,
            },
        )
        return {"userId": user_id, "email": claims.get("email", "")}

    def list_creators(self, user_id: str) -> list[dict[str, Any]]:
        follows = self.follows.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        ).get("Items", [])
        results = []
        for follow in follows:
            creator = self.creators.get_item(
                Key={"creatorId": follow["creatorId"]}
            ).get("Item")
            if not creator:
                continue
            statuses: dict[str, int] = {}
            source_rows = self.source_items.query(
                IndexName="creatorId-publishedAt-index",
                KeyConditionExpression=Key("creatorId").eq(follow["creatorId"]),
                ProjectionExpression="#status",
                ExpressionAttributeNames={"#status": "status"},
            ).get("Items", [])
            for row in source_rows:
                status = row.get("status", "UNKNOWN")
                statuses[status] = statuses.get(status, 0) + 1
            results.append({**creator, "importCounts": statuses})
        return sorted(results, key=lambda item: item.get("displayName", "").lower())

    def add_creator(self, user_id: str, value: str) -> dict[str, Any]:
        publication = canonicalize_publication(value)
        display_name, _ = self.feed_loader(publication)
        identifier = creator_id(publication.feed_url)
        now = _now().isoformat()
        creator = {
            "creatorId": identifier,
            "platform": "substack",
            "feedUrl": publication.feed_url,
            "siteUrl": publication.site_url,
            "displayName": display_name,
            "status": "ACTIVE",
            "createdAt": now,
        }
        try:
            self.creators.put_item(
                Item=creator,
                ConditionExpression="attribute_not_exists(creatorId)",
            )
        except ClientError as exc:
            if (
                exc.response.get("Error", {}).get("Code")
                != "ConditionalCheckFailedException"
            ):
                raise
            existing = self.creators.get_item(Key={"creatorId": identifier}).get("Item")
            if existing:
                creator = existing
        self.follows.put_item(
            Item={"userId": user_id, "creatorId": identifier, "followedAt": now}
        )
        self._invoke_discovery(identifier)
        return creator

    def remove_creator(self, user_id: str, identifier: str) -> None:
        self.follows.delete_item(Key={"userId": user_id, "creatorId": identifier})

    def check_creator(self, user_id: str, identifier: str) -> dict[str, Any]:
        if not self.follows.get_item(
            Key={"userId": user_id, "creatorId": identifier}
        ).get("Item"):
            raise PermissionError("You do not follow this creator.")
        creator = self.creators.get_item(Key={"creatorId": identifier}).get("Item")
        if not creator:
            raise KeyError("Creator not found.")
        last_requested = creator.get("lastCheckRequestedAt")
        if last_requested:
            parsed = datetime.fromisoformat(last_requested)
            if _now() - parsed < timedelta(minutes=15):
                raise RuntimeError("Please wait 15 minutes before checking again.")
        requested_at = _now().isoformat()
        self.creators.update_item(
            Key={"creatorId": identifier},
            UpdateExpression="SET lastCheckRequestedAt = :now",
            ExpressionAttributeValues={":now": requested_at},
        )
        self._invoke_discovery(identifier)
        return {"status": "QUEUED", "requestedAt": requested_at}

    def list_recipes(self, user_id: str) -> list[dict[str, Any]]:
        follows = self.follows.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        ).get("Items", [])
        rows: list[dict[str, Any]] = []
        for follow in follows:
            rows.extend(
                self.recipes.query(
                    IndexName="creatorId-publishedAt-index",
                    KeyConditionExpression=Key("creatorId").eq(follow["creatorId"]),
                    ScanIndexForward=False,
                    Limit=50,
                ).get("Items", [])
            )
        rows.sort(key=lambda item: item.get("publishedAt", ""), reverse=True)
        return rows[:100]

    def get_recipe(self, user_id: str, identifier: str) -> dict[str, Any]:
        recipe = self.recipes.get_item(Key={"recipeId": identifier}).get("Item")
        if not recipe:
            raise KeyError("Recipe not found.")
        followed = self.follows.get_item(
            Key={"userId": user_id, "creatorId": recipe["creatorId"]}
        ).get("Item")
        if not followed:
            raise PermissionError("You cannot access this recipe.")
        return recipe

    def _invoke_discovery(self, identifier: str) -> None:
        self.lambda_client.invoke(
            FunctionName=self.discovery_function_name,
            InvocationType="Event",
            Payload=json.dumps({"creatorId": identifier}).encode(),
        )


def _service() -> ApiService:
    dynamodb = boto3.resource("dynamodb")
    return ApiService(
        users=dynamodb.Table(os.environ["USERS_TABLE"]),
        creators=dynamodb.Table(os.environ["CREATORS_TABLE"]),
        follows=dynamodb.Table(os.environ["FOLLOWS_TABLE"]),
        source_items=dynamodb.Table(os.environ["SOURCE_ITEMS_TABLE"]),
        recipes=dynamodb.Table(os.environ["RECIPES_TABLE"]),
        lambda_client=boto3.client("lambda"),
        discovery_function_name=os.environ["DISCOVERY_FUNCTION_NAME"],
    )


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        user_id = _user_id(event)
        service = _service()
        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path = event.get("rawPath", "")
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        body = json.loads(event.get("body") or "{}")

        if method == "GET" and path == "/api/me":
            return _response(200, service.me(user_id, claims))
        if path == "/api/creators" and method == "GET":
            return _response(200, {"creators": service.list_creators(user_id)})
        if path == "/api/creators" and method == "POST":
            return _response(
                202, service.add_creator(user_id, str(body.get("url", "")))
            )
        if path == "/api/recipes" and method == "GET":
            return _response(200, {"recipes": service.list_recipes(user_id)})

        creator_match = re_match(r"^/api/creators/([^/]+)(/check)?$", path)
        if creator_match and method == "DELETE" and not creator_match.group(2):
            service.remove_creator(user_id, unquote(creator_match.group(1)))
            return _response(204, {})
        if creator_match and method == "POST" and creator_match.group(2):
            return _response(
                202, service.check_creator(user_id, unquote(creator_match.group(1)))
            )

        recipe_match = re_match(r"^/api/recipes/([^/]+)$", path)
        if recipe_match and method == "GET":
            return _response(
                200, service.get_recipe(user_id, unquote(recipe_match.group(1)))
            )
        return _response(404, {"message": "Route not found."})
    except json.JSONDecodeError:
        return _response(400, {"message": "Request body must be valid JSON."})
    except SubstackError as exc:
        return _response(400, {"message": str(exc)})
    except PermissionError as exc:
        return _response(403, {"message": str(exc)})
    except KeyError as exc:
        return _response(404, {"message": str(exc.args[0])})
    except RuntimeError as exc:
        return _response(429, {"message": str(exc)})


def re_match(pattern: str, value: str) -> Any:
    import re

    return re.match(pattern, value)
