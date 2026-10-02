from bite_backend.ids import creator_id, recipe_id, source_item_id


def test_ids_are_deterministic_and_namespaced() -> None:
    feed = "https://example.substack.com/feed"

    assert creator_id(feed) == creator_id(feed)
    assert source_item_id(feed) != creator_id(feed)
    assert recipe_id(source_item_id(feed), 0) != recipe_id(source_item_id(feed), 1)
    assert creator_id(feed).startswith("sha256:")
