import json

import pytest
from pydantic import ValidationError

from bite_backend.bedrock import RecipeExtractor


class FakeBedrock:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.request: dict | None = None

    def converse(self, **kwargs: object) -> dict:
        self.request = kwargs
        return {
            "output": {"message": {"content": [{"text": json.dumps(self.payload)}]}}
        }


def valid_recipe() -> dict:
    return {
        "title": "Toast",
        "description": "Quick toast",
        "ingredients": [
            {
                "raw": "1 slice bread",
                "name": "bread",
                "quantity": 1,
                "unit": "slice",
                "optional": False,
            }
        ],
        "instructions": ["Toast the bread."],
        "cookTimeMinutes": 3,
        "servings": 1,
        "tags": ["breakfast"],
        "extractionConfidence": 0.98,
    }


def test_extracts_validated_recipe_with_structured_output() -> None:
    client = FakeBedrock({"recipes": [valid_recipe()]})
    result = RecipeExtractor(client=client).extract("Toast", "Toast one slice.")

    assert result.recipes[0].title == "Toast"
    assert client.request is not None
    assert client.request["modelId"] == "zai.glm-4.7-flash"
    text_format = client.request["outputConfig"]["textFormat"]
    assert text_format["type"] == "json_schema"
    schema = json.loads(text_format["structure"]["jsonSchema"]["schema"])
    assert schema["additionalProperties"] is False
    assert schema["properties"]["recipes"]["items"]["properties"]["ingredients"]


def test_rejects_invalid_model_output() -> None:
    bad = valid_recipe()
    bad["extractionConfidence"] = 3

    with pytest.raises(ValidationError):
        RecipeExtractor(client=FakeBedrock({"recipes": [bad]})).extract("Bad", "Bad")


def test_rejects_ingredient_without_a_name() -> None:
    bad = valid_recipe()
    bad["ingredients"][0]["name"] = "   "

    with pytest.raises(ValidationError):
        RecipeExtractor(client=FakeBedrock({"recipes": [bad]})).extract("Bad", "Bad")


def test_separates_numbered_steps_returned_in_one_string() -> None:
    recipe = valid_recipe()
    recipe["instructions"] = [
        "1. Heat the pan. 2. Add the bread. 3. Toast until golden."
    ]

    result = RecipeExtractor(client=FakeBedrock({"recipes": [recipe]})).extract(
        "Toast", "Toast"
    )

    assert result.recipes[0].instructions == [
        "Heat the pan.",
        "Add the bread.",
        "Toast until golden.",
    ]
