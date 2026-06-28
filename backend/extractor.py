import os
from typing import List, Tuple

import requests

from models import CarouselItem, FormatOption, MediaInfo

# ---------------------------------------------------------------------------
# RapidAPI Configuration
# ---------------------------------------------------------------------------

RAPIDAPI_URL = "https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink"
RAPIDAPI_KEYS = [k.strip() for k in os.getenv("RAPIDAPI_KEY", "").split(",") if k.strip()]
RAPIDAPI_HOST = "social-download-all-in-one.p.rapidapi.com"


# ---------------------------------------------------------------------------
# Custom exception hierarchy for clear HTTP error mapping
# ---------------------------------------------------------------------------

class MediaExtractionError(Exception):
    """Base class — carry an http_status so routes can return the right code."""
    http_status: int = 400


class PrivateContentError(MediaExtractionError):
    """Content exists but requires authentication / is from a private account."""
    http_status: int = 400


class ContentNotFoundError(MediaExtractionError):
    """Content has been removed or is otherwise unavailable."""
    http_status: int = 404


class AccountGoneError(MediaExtractionError):
    """The account/channel that hosted this content no longer exists."""
    http_status: int = 410


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def detect_source(url: str) -> str:
    lowered = url.lower()
    if "youtube.com" in lowered or "youtu.be" in lowered:
        return "youtube"
    if "instagram.com" in lowered:
        return "instagram"
    if "tiktok.com" in lowered:
        return "tiktok"
    return "other"


def _get_filesize_from_head(url: str) -> int:
    """Attempt a HEAD request to get Content-Length. Returns 0 on failure."""
    if not url:
        return 0
    try:
        resp = requests.head(url, timeout=3, allow_redirects=True)
        length = resp.headers.get("Content-Length")
        return int(length) if length else 0
    except Exception:
        return 0


def _call_rapidapi(url: str) -> dict:
    """Send the URL to RapidAPI and return the parsed JSON response."""
    if not RAPIDAPI_KEYS:
        raise MediaExtractionError(
            "The server is missing its RAPIDAPI_KEY. Please contact the admin."
        )

    last_exc = None
    for key in RAPIDAPI_KEYS:
        headers = {
            "Content-Type": "application/json",
            "x-rapidapi-host": RAPIDAPI_HOST,
            "x-rapidapi-key": key,
        }

        try:
            resp = requests.post(RAPIDAPI_URL, json={"url": url}, headers=headers, timeout=30)
            
            # If rate limited or unauthorized by RapidAPI, try the next key
            if resp.status_code in (401, 403, 429):
                last_exc = MediaExtractionError("API key limit reached or unauthorized.")
                continue

            data = resp.json()

            if data.get("error"):
                msg = ""
                if isinstance(data.get("message"), str):
                    msg = data["message"].lower()
                elif isinstance(data.get("data"), dict):
                    msg = (data["data"].get("message") or "").lower()

                # Check if the API provider itself returned a quota/limit error inside the payload
                if "limit" in msg or "quota" in msg:
                    last_exc = MediaExtractionError("API provider limit reached.")
                    continue

                if "private" in msg or "restricted" in msg or "cookie" in msg:
                    raise PrivateContentError(
                        "This content is private or requires a login. "
                        "Only public posts that are visible without logging in can be downloaded."
                    )
                raise MediaExtractionError(
                    "We couldn't fetch that link. It may be private, region-locked, or temporarily unavailable."
                )

            return data

        except requests.RequestException as exc:
            last_exc = exc
            continue

    if isinstance(last_exc, MediaExtractionError):
        raise last_exc

    raise MediaExtractionError(
        "We couldn't reach the download service. Please try again in a moment."
    ) from last_exc


def _build_formats_from_medias(medias: list) -> Tuple[List[FormatOption], str]:
    """
    Parse RapidAPI's `medias` array into our FormatOption model list.
    Returns (formats, media_type).
    """
    formats: List[FormatOption] = []
    media_type = "video"

    for i, m in enumerate(medias):
        m_type = m.get("type", "video")
        quality = m.get("quality", "")
        ext = m.get("extension", "mp4")
        download_url = m.get("url", "")

        if not download_url:
            continue

        width = m.get("width")
        height = m.get("height")
        resolution = f"{width}x{height}" if width and height else None

        if m_type == "video":
            # Build a readable label from quality + resolution
            if quality and "watermark" not in quality.lower():
                label = quality
            elif height:
                label = f"{height}p"
            else:
                label = f"Video {i + 1}"
            fmt_type = "video"
        elif m_type == "audio":
            label = quality if quality else "Audio"
            fmt_type = "audio"
            media_type = "audio" if not formats else media_type
        elif m_type == "image":
            label = quality if quality else "Image"
            fmt_type = "image"
            media_type = "image" if not formats else media_type
        else:
            label = quality or f"Media {i + 1}"
            fmt_type = "video"

        # Skip watermarked versions
        if "watermark" in quality.lower() and "no_watermark" not in quality.lower():
            continue

        filesize = m.get("data_size") or 0
        filesize_estimated = False

        formats.append(
            FormatOption(
                format_id=str(i),
                ext=ext,
                type=fmt_type,
                resolution=resolution,
                fps=None,
                abr=None,
                filesize=filesize,
                filesize_is_estimate=filesize_estimated,
                note=label,
                download_url=download_url,
            )
        )

    return formats, media_type


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_info(url: str) -> MediaInfo:
    """Fetch metadata + available formats via RapidAPI without downloading anything."""
    data = _call_rapidapi(url)

    source = data.get("source") or detect_source(url)
    title = data.get("title") or "Untitled"
    thumbnail = data.get("thumbnail")
    uploader = data.get("author") or data.get("unique_id") or "Unknown"
    duration_ms = data.get("duration")
    duration = duration_ms / 1000.0 if duration_ms and duration_ms > 1000 else duration_ms

    medias = data.get("medias") or []

    if not medias:
        raise MediaExtractionError(
            "No downloadable media found for this link. It may be private or unsupported."
        )

    formats, media_type = _build_formats_from_medias(medias)

    if not formats:
        raise MediaExtractionError(
            "No downloadable formats found for this link."
        )

    return MediaInfo(
        title=title,
        thumbnail=thumbnail,
        duration=duration,
        uploader=uploader,
        source=source,
        media_type=media_type,
        formats=formats,
        carousel_items=[],
    )
