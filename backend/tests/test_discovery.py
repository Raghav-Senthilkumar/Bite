from botocore.exceptions import ClientError

from bite_backend.discovery import discover_creator
from bite_backend.substack import FeedItem


class FakeSourceItems:
    def __init__(self) -> None:
        self.items: dict[str, dict] = {}

    def put_item(self, *, Item: dict, ConditionExpression: str) -> None:
        assert ConditionExpression == "attribute_not_exists(sourceItemId)"
        key = Item["sourceItemId"]
        if key in self.items:
            raise ClientError(
                {
                    "Error": {
                        "Code": "ConditionalCheckFailedException",
                        "Message": "duplicate",
                    }
                },
                "PutItem",
            )
        self.items[key] = Item


class FakeQueue:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    def send_message(self, **kwargs: object) -> None:
        self.messages.append(kwargs)


def test_discovery_is_idempotent() -> None:
    table = FakeSourceItems()
    queue = FakeQueue()
    creator = {
        "creatorId": "creator-1",
        "displayName": "Kitchen",
        "siteUrl": "https://kitchen.substack.com",
        "feedUrl": "https://kitchen.substack.com/feed",
    }
    post = FeedItem(
        "Pie", "https://kitchen.substack.com/p/pie", "post-1", "2024-01-01T00:00:00Z"
    )
    loader = lambda _publication: ("Kitchen", [post])

    first = discover_creator(
        creator, source_items=table, queue=queue, queue_url="queue", feed_loader=loader
    )
    second = discover_creator(
        creator, source_items=table, queue=queue, queue_url="queue", feed_loader=loader
    )

    assert first == 1
    assert second == 0
    assert len(queue.messages) == 1
