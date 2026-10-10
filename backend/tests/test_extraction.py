from decimal import Decimal

from bite_backend.extraction import process_source_item
from bite_backend.models import ExtractedRecipe, ExtractionResult, Ingredient


class FakeTable:
    def __init__(self, item: dict | None = None) -> None:
        self.item = item
        self.puts: list[dict] = []
        self.updates: list[dict] = []

    def get_item(self, **_kwargs: object) -> dict:
        return {"Item": self.item} if self.item else {}

    def update_item(self, **kwargs: object) -> None:
        self.updates.append(kwargs)

    def put_item(self, **kwargs: object) -> None:
        self.puts.append(kwargs["Item"])


class FakeExtractor:
    def extract(self, _title: str, _text: str) -> ExtractionResult:
        return ExtractionResult(
            recipes=[
                ExtractedRecipe(
                    title="Soup",
                    ingredients=[
                        Ingredient(
                            raw="1.5 cups stock",
                            name="stock",
                            quantity=1.5,
                            unit="cup",
                        )
                    ],
                    instructions=["Simmer."],
                    extractionConfidence=0.9,
                )
            ]
        )


def test_process_source_item_writes_recipe_and_completes() -> None:
    source = FakeTable(
        {
            "sourceItemId": "source-1",
            "creatorId": "creator-1",
            "sourceUrl": "https://demo.substack.com/p/soup",
            "image": "https://cdn.example.com/soup.jpg",
            "title": "Soup",
            "publishedAt": "2024-01-01T00:00:00Z",
            "status": "QUEUED",
        }
    )
    recipes = FakeTable()

    count = process_source_item(
        "source-1",
        source_items=source,
        recipes=recipes,
        extractor=FakeExtractor(),
        article_loader=lambda _url: "Soup recipe",
    )

    assert count == 1
    assert recipes.puts[0]["ingredients"][0]["quantity"] == Decimal("1.5")
    assert recipes.puts[0]["image"] == "https://cdn.example.com/soup.jpg"
    assert source.updates[-1]["ExpressionAttributeValues"][":status"] == "COMPLETE"


def test_completed_source_is_not_reprocessed() -> None:
    source = FakeTable({"sourceItemId": "source-1", "status": "COMPLETE"})
    recipes = FakeTable()

    assert (
        process_source_item(
            "source-1",
            source_items=source,
            recipes=recipes,
            extractor=FakeExtractor(),
        )
        == 0
    )
    assert not recipes.puts
