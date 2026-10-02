import pytest

from bite_backend.substack import (
    Publication,
    SubstackError,
    canonicalize_publication,
    clean_html,
    parse_feed,
)


def test_canonicalizes_handle_and_url() -> None:
    from_handle = canonicalize_publication("@Jad-Saad")
    from_url = canonicalize_publication("http://JAD-SAAD.substack.com/archive?q=1")

    assert from_handle == from_url
    assert from_handle.feed_url == "https://jad-saad.substack.com/feed"


@pytest.mark.parametrize(
    "value",
    ["", "https://example.com", "file:///etc/passwd", "https://substack.com"],
)
def test_rejects_unsupported_urls(value: str) -> None:
    with pytest.raises(SubstackError):
        canonicalize_publication(value)


def test_parses_rss_items() -> None:
    publication = Publication(
        "Demo", "https://demo.substack.com", "https://demo.substack.com/feed"
    )
    xml = b"""<?xml version="1.0"?>
    <rss><channel><title>Demo Kitchen</title><item>
      <title>Soup</title><link>https://demo.substack.com/p/soup</link>
      <guid>post-1</guid><pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item></channel></rss>"""

    name, items = parse_feed(xml, publication)

    assert name == "Demo Kitchen"
    assert len(items) == 1
    assert items[0].guid == "post-1"
    assert items[0].published_at == "2024-01-01T12:00:00+00:00"


def test_clean_html_removes_code_and_keeps_blocks() -> None:
    text = clean_html(
        "<h1>Pasta &amp; peas</h1><script>bad()</script><p>Boil.</p><p>Serve.</p>"
    )

    assert text == "Pasta & peas\n\nBoil.\n\nServe."
    assert "bad" not in text
