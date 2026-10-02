import json

from bite_backend.health import handler


def test_health_returns_ok() -> None:
    response = handler({}, None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {"status": "ok"}
