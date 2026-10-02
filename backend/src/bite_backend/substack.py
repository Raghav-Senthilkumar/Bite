from __future__ import annotations

import html
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import ClassVar
from urllib.parse import urlparse, urlunparse

USER_AGENT = "Bite/0.1 (+public recipe feed reader)"
MAX_DOWNLOAD_BYTES = 2_000_000
MAX_ARTICLE_CHARS = 60_000


class SubstackError(ValueError):
    pass


@dataclass(frozen=True)
class Publication:
    display_name: str
    site_url: str
    feed_url: str


@dataclass(frozen=True)
class FeedItem:
    title: str
    url: str
    guid: str
    published_at: str


class _TextExtractor(HTMLParser):
    block_tags: ClassVar[set[str]] = {
        "p",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "li",
        "blockquote",
        "br",
    }

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.ignored_depth += 1
        elif tag in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.ignored_depth:
            self.ignored_depth -= 1
        elif tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth:
            self.parts.append(data)


def clean_html(raw_html: str | None) -> str:
    if not raw_html:
        return ""
    parser = _TextExtractor()
    parser.feed(raw_html)
    text = html.unescape("".join(parser.parts))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def canonicalize_publication(value: str) -> Publication:
    candidate = value.strip()
    if not candidate:
        raise SubstackError("Enter a Substack publication URL or handle.")
    if "://" not in candidate:
        handle = candidate.removeprefix("@").split(".", 1)[0].lower()
        candidate = f"https://{handle}.substack.com"

    parsed = urlparse(candidate)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not hostname.endswith(".substack.com"):
        raise SubstackError("Only public *.substack.com publications are supported.")
    if hostname.count(".") < 2:
        raise SubstackError(
            "Enter a publication subdomain, such as example.substack.com."
        )

    site_url = urlunparse(("https", hostname, "", "", "", ""))
    return Publication(
        display_name=hostname.split(".", 1)[0].replace("-", " ").title(),
        site_url=site_url,
        feed_url=f"{site_url}/feed",
    )


def fetch_bytes(url: str, timeout: int = 20) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml,text/html,application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read(MAX_DOWNLOAD_BYTES + 1)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SubstackError(f"Could not fetch public Substack content: {exc}") from exc
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise SubstackError("Substack response exceeded the safe download limit.")
    return data


def _iso_date(value: str | None) -> str:
    if not value:
        return datetime.now(UTC).isoformat()
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return datetime.now(UTC).isoformat()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat()


def parse_feed(data: bytes, publication: Publication) -> tuple[str, list[FeedItem]]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise SubstackError(
            "The publication did not return a valid RSS/Atom feed."
        ) from exc

    channel = root.find("channel")
    if channel is not None:
        display_name = (channel.findtext("title") or publication.display_name).strip()
        items = []
        for item in channel.findall("item"):
            url = (item.findtext("link") or "").strip()
            if not url:
                continue
            items.append(
                FeedItem(
                    title=(item.findtext("title") or "Untitled post").strip(),
                    url=url,
                    guid=(item.findtext("guid") or url).strip(),
                    published_at=_iso_date(item.findtext("pubDate")),
                )
            )
        return display_name, items

    namespace = "{http://www.w3.org/2005/Atom}"
    display_name = (
        root.findtext(f"{namespace}title") or publication.display_name
    ).strip()
    items = []
    for entry in root.findall(f"{namespace}entry"):
        link = entry.find(f"{namespace}link")
        url = (link.attrib.get("href", "") if link is not None else "").strip()
        if not url:
            continue
        items.append(
            FeedItem(
                title=(entry.findtext(f"{namespace}title") or "Untitled post").strip(),
                url=url,
                guid=(entry.findtext(f"{namespace}id") or url).strip(),
                published_at=_iso_date(
                    entry.findtext(f"{namespace}published")
                    or entry.findtext(f"{namespace}updated")
                ),
            )
        )
    return display_name, items


def fetch_feed(publication: Publication) -> tuple[str, list[FeedItem]]:
    return parse_feed(fetch_bytes(publication.feed_url), publication)


def fetch_article_text(source_url: str) -> str:
    parsed = urlparse(source_url)
    hostname = (parsed.hostname or "").lower()
    slug = parsed.path.rstrip("/").split("/")[-1]
    if hostname.endswith(".substack.com") and slug:
        api_url = f"https://{hostname}/api/v1/posts/{slug}"
        try:
            payload = json.loads(fetch_bytes(api_url))
            body = (
                payload.get("body_html")
                or payload.get("html_body")
                or payload.get("body")
            )
            text = clean_html(body)
            if text:
                return text[:MAX_ARTICLE_CHARS]
        except (SubstackError, json.JSONDecodeError, UnicodeDecodeError):
            pass
    raw_page = fetch_bytes(source_url).decode("utf-8", errors="replace")
    return clean_html(raw_page)[:MAX_ARTICLE_CHARS]
