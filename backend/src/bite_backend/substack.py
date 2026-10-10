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
from urllib.parse import quote, urljoin, urlparse, urlunparse

USER_AGENT = "Bite/0.1 (+public recipe feed reader)"
MAX_DOWNLOAD_BYTES = 2_000_000
MAX_ARTICLE_CHARS = 60_000
MAX_IMAGE_URL_CHARS = 2_048
MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/"


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
    image_url: str | None = None


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


class _FirstImageExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.image_urls: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag.lower() != "img":
            return
        values = {name.lower(): value for name, value in attrs if value}
        for name in ("src", "data-src"):
            if values.get(name):
                self.image_urls.append(values[name])
        if values.get("srcset"):
            for source in values["srcset"].split(","):
                parts = source.strip().split()
                if parts:
                    self.image_urls.append(parts[0])


def _tag_parts(tag: str) -> tuple[str, str]:
    if tag.startswith("{") and "}" in tag:
        namespace, local_name = tag[1:].split("}", 1)
        return namespace, local_name.lower()
    return "", tag.lower()


def _safe_image_url(value: str | None, *, base_url: str = "") -> str | None:
    if not isinstance(value, str) or not value:
        return None
    candidate = html.unescape(value).strip()
    if not candidate or len(candidate) > MAX_IMAGE_URL_CHARS:
        return None
    if any(ord(character) < 32 for character in candidate):
        return None
    if base_url:
        candidate = urljoin(base_url, candidate)
    try:
        parsed = urlparse(candidate)
        if (
            parsed.scheme.lower() != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port == 0
        ):
            return None
    except ValueError:
        return None
    return urlunparse(
        (
            "https",
            parsed.netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            "",
        )
    )


def _first_image_from_html(raw_html: str | None, *, base_url: str) -> str | None:
    if not raw_html:
        return None
    parser = _FirstImageExtractor()
    try:
        parser.feed(html.unescape(raw_html))
    except (TypeError, ValueError):
        return None
    for candidate in parser.image_urls:
        image_url = _safe_image_url(candidate, base_url=base_url)
        if image_url:
            return image_url
    return None


def _image_from_feed_entry(entry: ET.Element, *, base_url: str) -> str | None:
    descendants = list(entry.iter())

    for element in descendants:
        namespace, local_name = _tag_parts(element.tag)
        if namespace != MEDIA_NAMESPACE or local_name != "content":
            continue
        media_type = (element.attrib.get("type") or "").lower()
        medium = (element.attrib.get("medium") or "").lower()
        if medium == "image" or media_type.startswith("image/"):
            image_url = _safe_image_url(element.attrib.get("url"), base_url=base_url)
            if image_url:
                return image_url

    for element in descendants:
        _namespace, local_name = _tag_parts(element.tag)
        is_enclosure = local_name == "enclosure" or (
            local_name == "link"
            and element.attrib.get("rel", "").lower() == "enclosure"
        )
        if not is_enclosure:
            continue
        media_type = (element.attrib.get("type") or "").lower()
        if media_type.startswith("image/"):
            image_url = _safe_image_url(
                element.attrib.get("url") or element.attrib.get("href"),
                base_url=base_url,
            )
            if image_url:
                return image_url

    for element in descendants:
        namespace, local_name = _tag_parts(element.tag)
        if namespace == MEDIA_NAMESPACE and local_name == "thumbnail":
            image_url = _safe_image_url(element.attrib.get("url"), base_url=base_url)
            if image_url:
                return image_url

    for element in descendants:
        namespace, local_name = _tag_parts(element.tag)
        if namespace == MEDIA_NAMESPACE or local_name not in {
            "encoded",
            "content",
            "description",
            "summary",
        }:
            continue
        image_url = _first_image_from_html(element.text, base_url=base_url)
        if image_url:
            return image_url
        for child in element.iter():
            _child_namespace, child_name = _tag_parts(child.tag)
            if child_name != "img":
                continue
            image_url = _safe_image_url(
                child.attrib.get("src") or child.attrib.get("data-src"),
                base_url=base_url,
            )
            if image_url:
                return image_url
    return None


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
                    image_url=_image_from_feed_entry(item, base_url=url),
                )
            )
        return display_name, items

    namespace = "{http://www.w3.org/2005/Atom}"
    display_name = (
        root.findtext(f"{namespace}title") or publication.display_name
    ).strip()
    items = []
    for entry in root.findall(f"{namespace}entry"):
        links = entry.findall(f"{namespace}link")
        link = next(
            (
                candidate
                for candidate in links
                if candidate.attrib.get("rel", "alternate") == "alternate"
            ),
            links[0] if links else None,
        )
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
                image_url=_image_from_feed_entry(entry, base_url=url),
            )
        )
    return display_name, items


def fetch_feed(publication: Publication) -> tuple[str, list[FeedItem]]:
    return parse_feed(fetch_bytes(publication.feed_url), publication)


def fetch_article_image_url(source_url: str) -> str | None:
    try:
        parsed = urlparse(source_url)
        hostname = (parsed.hostname or "").lower().rstrip(".")
        path_parts = [part for part in parsed.path.split("/") if part]
        if (
            parsed.scheme != "https"
            or not hostname.endswith(".substack.com")
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port not in (None, 443)
            or len(path_parts) != 2
            or path_parts[0] != "p"
        ):
            return None
        slug = path_parts[1]
        api_url = f"https://{hostname}/api/v1/posts/{quote(slug, safe='')}"
        payload = json.loads(fetch_bytes(api_url))
        if not isinstance(payload, dict):
            return None
        cover_image = _safe_image_url(payload.get("cover_image"), base_url=source_url)
        if cover_image:
            return cover_image
        body = payload.get("body_html") or payload.get("html_body") or payload.get("body")
        return _first_image_from_html(
            body if isinstance(body, str) else None,
            base_url=source_url,
        )
    except (
        SubstackError,
        json.JSONDecodeError,
        UnicodeDecodeError,
        TypeError,
        ValueError,
    ):
        return None


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
