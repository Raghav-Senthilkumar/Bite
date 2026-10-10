import json

import pytest

from bite_backend import substack
from bite_backend.substack import (
    Publication,
    SubstackError,
    canonicalize_publication,
    clean_html,
    fetch_article_image_url,
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


def test_parses_rss_media_image_before_html_fallback() -> None:
    publication = Publication(
        "Demo", "https://demo.substack.com", "https://demo.substack.com/feed"
    )
    xml = b"""<?xml version="1.0"?>
    <rss xmlns:media="http://search.yahoo.com/mrss/"
         xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel><item>
        <title>Soup</title><link>https://demo.substack.com/p/soup</link>
        <media:content url="https://cdn.example.com/cover.jpg" type="image/jpeg" />
        <content:encoded><![CDATA[
          <img src="https://cdn.example.com/body.jpg">
        ]]></content:encoded>
      </item></channel>
    </rss>"""

    _name, items = parse_feed(xml, publication)

    assert items[0].image_url == "https://cdn.example.com/cover.jpg"


def test_parses_rss_enclosure_and_rejects_unsafe_html_image() -> None:
    publication = Publication(
        "Demo", "https://demo.substack.com", "https://demo.substack.com/feed"
    )
    xml = b"""<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Pie</title><link>https://demo.substack.com/p/pie</link>
        <enclosure url="https://cdn.example.com/pie.jpg" type="image/jpeg" />
      </item>
      <item>
        <title>Unsafe</title><link>https://demo.substack.com/p/unsafe</link>
        <description><![CDATA[<img src="javascript:alert(1)">]]></description>
      </item>
    </channel></rss>"""

    _name, items = parse_feed(xml, publication)

    assert items[0].image_url == "https://cdn.example.com/pie.jpg"
    assert items[1].image_url is None


def test_parses_atom_enclosure_without_using_it_as_the_post_url() -> None:
    publication = Publication(
        "Demo", "https://demo.substack.com", "https://demo.substack.com/feed"
    )
    xml = b"""<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Demo Kitchen</title><entry>
        <title>Stew</title><id>post-2</id>
        <link rel="enclosure" type="image/webp" href="https://cdn.example.com/stew.webp" />
        <link rel="alternate" href="https://demo.substack.com/p/stew" />
        <updated>2024-01-02T12:00:00Z</updated>
      </entry>
    </feed>"""

    _name, items = parse_feed(xml, publication)

    assert items[0].url == "https://demo.substack.com/p/stew"
    assert items[0].image_url == "https://cdn.example.com/stew.webp"


def test_fetch_article_image_prefers_cover_image(monkeypatch: pytest.MonkeyPatch) -> None:
    requested: list[str] = []

    def fake_fetch(url: str, timeout: int = 20) -> bytes:
        requested.append(url)
        return json.dumps(
            {
                "cover_image": "https://cdn.example.com/cover.jpg#fragment",
                "body_html": '<img src="https://cdn.example.com/body.jpg">',
            }
        ).encode()

    monkeypatch.setattr(substack, "fetch_bytes", fake_fetch)

    image_url = fetch_article_image_url("https://demo.substack.com/p/soup")

    assert image_url == "https://cdn.example.com/cover.jpg"
    assert requested == ["https://demo.substack.com/api/v1/posts/soup"]


def test_fetch_article_image_uses_first_safe_body_image(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = {
        "cover_image": "javascript:alert(1)",
        "body_html": (
            '<img src="data:image/gif;base64,bad">'
            '<img src="/images/soup.webp">'
        ),
    }
    monkeypatch.setattr(
        substack,
        "fetch_bytes",
        lambda _url, timeout=20: json.dumps(payload).encode(),
    )

    assert fetch_article_image_url("https://demo.substack.com/p/soup") == (
        "https://demo.substack.com/images/soup.webp"
    )


def test_fetch_article_image_does_not_fetch_non_substack_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_fetch(_url: str, timeout: int = 20) -> bytes:
        raise AssertionError("fetch_bytes must not be called")

    monkeypatch.setattr(substack, "fetch_bytes", unexpected_fetch)

    assert fetch_article_image_url("https://example.com/p/soup") is None


def test_clean_html_removes_code_and_keeps_blocks() -> None:
    text = clean_html(
        "<h1>Pasta &amp; peas</h1><script>bad()</script><p>Boil.</p><p>Serve.</p>"
    )

    assert text == "Pasta & peas\n\nBoil.\n\nServe."
    assert "bad" not in text
