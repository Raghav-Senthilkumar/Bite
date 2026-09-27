import json
from typing import Any


def handler(
    _event: dict[str, Any],
    _context: Any,
) -> dict[str, Any]:
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"status": "ok"}),
    }