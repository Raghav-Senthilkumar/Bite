import hashlib


def stable_id(*parts: str) -> str:
    value = "|".join(parts).encode("utf-8")
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def creator_id(feed_url: str) -> str:
    return stable_id(feed_url)


def source_item_id(guid_or_url: str) -> str:
    return stable_id("substack", guid_or_url)


def recipe_id(source_id: str, index: int) -> str:
    return stable_id(source_id, str(index))
