import json

import pytest

from bite_backend.api import ApiService, _user_id


class FakeTable:
    def __init__(self, items: dict[tuple, dict] | None = None) -> None:
        self.items = items or {}
        self.puts: list[dict] = []
        self.deletes: list[dict] = []

    def put_item(self, **kwargs: object) -> None:
        self.puts.append(kwargs["Item"])

    def get_item(self, *, Key: dict) -> dict:
        key = tuple(Key.values())
        item = self.items.get(key)
        return {"Item": item} if item else {}

    def delete_item(self, *, Key: dict) -> None:
        self.deletes.append(Key)


class FakeLambda:
    def __init__(self) -> None:
        self.invocations: list[dict] = []

    def invoke(self, **kwargs: object) -> None:
        self.invocations.append(kwargs)


def service(**overrides: object) -> ApiService:
    values = {
        "users": FakeTable(),
        "creators": FakeTable(),
        "follows": FakeTable(),
        "source_items": FakeTable(),
        "recipes": FakeTable(),
        "lambda_client": FakeLambda(),
        "discovery_function_name": "discovery",
        "feed_loader": lambda _publication: ("Demo Kitchen", []),
    }
    values.update(overrides)
    return ApiService(**values)


def test_requires_verified_jwt_subject() -> None:
    with pytest.raises(PermissionError):
        _user_id({"requestContext": {}})

    assert (
        _user_id(
            {"requestContext": {"authorizer": {"jwt": {"claims": {"sub": "user-1"}}}}}
        )
        == "user-1"
    )


def test_add_creator_writes_follow_and_invokes_discovery() -> None:
    creators = FakeTable()
    follows = FakeTable()
    lambda_client = FakeLambda()
    api = service(creators=creators, follows=follows, lambda_client=lambda_client)

    creator = api.add_creator("user-1", "demo")

    assert creator["displayName"] == "Demo Kitchen"
    assert creators.puts[0]["feedUrl"] == "https://demo.substack.com/feed"
    assert follows.puts[0]["userId"] == "user-1"
    payload = json.loads(lambda_client.invocations[0]["Payload"])
    assert payload == {"creatorId": creator["creatorId"]}


def test_recipe_access_is_scoped_to_follow() -> None:
    recipes = FakeTable(
        {("recipe-1",): {"recipeId": "recipe-1", "creatorId": "creator-1"}}
    )
    api = service(recipes=recipes)

    with pytest.raises(PermissionError):
        api.get_recipe("user-1", "recipe-1")
