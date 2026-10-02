from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Ingredient(BaseModel):
    model_config = ConfigDict(extra="forbid")

    raw: str = Field(min_length=1)
    name: str = Field(min_length=1)
    quantity: float | None = None
    unit: str | None = None
    optional: bool = False

    @field_validator("raw", "name")
    @classmethod
    def require_visible_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must contain visible text")
        return cleaned


class ExtractedRecipe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: str = ""
    ingredients: list[Ingredient] = Field(min_length=1)
    instructions: list[str] = Field(min_length=1)
    cookTimeMinutes: int | None = Field(default=None, ge=0)
    servings: int | None = Field(default=None, ge=1)
    tags: list[str] = Field(default_factory=list)
    extractionConfidence: float = Field(ge=0, le=1)

    @field_validator("title")
    @classmethod
    def require_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must contain visible text")
        return cleaned

    @field_validator("instructions", mode="before")
    @classmethod
    def separate_numbered_steps(cls, value: Any) -> Any:
        if not isinstance(value, list):
            return value
        separated: list[str] = []
        numbered_step = re.compile(
            r"(?:^|\n|\s+(?=(?:step\s+)?\d+[.)\-:]\s+))"
            r"(?:step\s+)?\d+[.)\-:]\s+",
            flags=re.IGNORECASE,
        )
        bullet_step = re.compile(r"(?:^|\n)\s*[-•]\s+")
        for item in value:
            if not isinstance(item, str):
                separated.append(item)
                continue
            cleaned = item.strip()
            if not cleaned:
                continue
            numbered_parts = [
                part.strip() for part in numbered_step.split(cleaned) if part.strip()
            ]
            if len(numbered_parts) > 1:
                separated.extend(numbered_parts)
                continue
            bullet_parts = [
                part.strip() for part in bullet_step.split(cleaned) if part.strip()
            ]
            separated.extend(bullet_parts)
        return separated


class ExtractionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipes: list[ExtractedRecipe] = Field(default_factory=list)


class ExtractionMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceItemId: str


def recipe_output_schema() -> dict[str, Any]:
    """Bedrock structured-output schema for recipe extraction."""
    ingredient = {
        "type": "object",
        "properties": {
            "raw": {
                "type": "string",
                "description": "The complete ingredient line exactly as written in the source.",
            },
            "name": {
                "type": "string",
                "description": (
                    "Required concise normalized ingredient name, such as garlic or olive oil. "
                    "Never include quantity, unit, preparation text, or an empty value."
                ),
            },
            "quantity": {
                "anyOf": [{"type": "number"}, {"type": "null"}],
                "description": "Numeric amount stated in the source, or null when not stated.",
            },
            "unit": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "description": "Canonical singular unit, or null when no unit is stated.",
            },
            "optional": {
                "type": "boolean",
                "description": "True only when the source says the ingredient is optional.",
            },
        },
        "required": ["raw", "name", "quantity", "unit", "optional"],
        "additionalProperties": False,
    }
    recipe = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Complete recipe title."},
            "description": {
                "type": "string",
                "description": "Brief factual description based only on the source.",
            },
            "ingredients": {
                "type": "array",
                "description": "Every ingredient listed for this recipe, in source order.",
                "items": ingredient,
            },
            "instructions": {
                "type": "array",
                "description": (
                    "Ordered method steps. Each numbered source step must be one separate array "
                    "entry. Never place the full method in one string."
                ),
                "items": {
                    "type": "string",
                    "description": "One complete cooking step without a leading step number.",
                },
            },
            "cookTimeMinutes": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "description": "Total cook time in minutes when explicitly stated, else null.",
            },
            "servings": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "description": "Serving count when explicitly stated, else null.",
            },
            "tags": {
                "type": "array",
                "description": "Short factual recipe categories supported by the source.",
                "items": {"type": "string"},
            },
            "extractionConfidence": {
                "type": "number",
                "description": "Confidence from 0 to 1 based on recipe completeness.",
            },
        },
        "required": [
            "title",
            "description",
            "ingredients",
            "instructions",
            "cookTimeMinutes",
            "servings",
            "tags",
            "extractionConfidence",
        ],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "recipes": {
                "type": "array",
                "description": "Complete recipes in the order they appear in the article.",
                "items": recipe,
            }
        },
        "required": ["recipes"],
        "additionalProperties": False,
    }
