import os
from urllib.parse import urlparse

import requests as http_requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from extractor import (
    AccountGoneError,
    ContentNotFoundError,
    MediaExtractionError,
    PrivateContentError,
    extract_info,
)
from limiter import limiter
from models import DownloadRequest, InfoRequest, MediaInfo

router = APIRouter()

# Allow-list of domains the frontend is permitted to request.
ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
    "instagram.com",
    "www.instagram.com",
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
}


def _validate_url(url: str) -> None:
    """Raise HTTPException if the URL is not a safe, allow-listed http/https URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="That doesn't look like a valid URL. Please double-check and try again.")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400, detail="Only YouTube, Instagram, and TikTok links are supported."
        )

    full_host = (parsed.hostname or "").lower()
    if full_host not in ALLOWED_HOSTS:
        raise HTTPException(
            status_code=400,
            detail="Only YouTube, Instagram, and TikTok links are supported. Please paste a valid link from one of these platforms.",
        )


def _extraction_error_to_http(exc: MediaExtractionError) -> HTTPException:
    """Map our custom error hierarchy to the correct HTTP status code."""
    if isinstance(exc, PrivateContentError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, ContentNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, AccountGoneError):
        return HTTPException(status_code=410, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/api/info", response_model=MediaInfo)
@limiter.limit("15/minute")
def get_info(payload: InfoRequest, request: Request):
    _validate_url(payload.url)
    try:
        return extract_info(payload.url)
    except MediaExtractionError as exc:
        raise _extraction_error_to_http(exc)
    except Exception:
        # Unexpected error — never leak raw exception details to the user.
        raise HTTPException(
            status_code=400,
            detail="We couldn't fetch that link. It may be private, region-locked, or temporarily unavailable. Please try again.",
        )


@router.post("/api/download")
@limiter.limit("10/minute")
def download(payload: DownloadRequest, request: Request):
    """
    Proxy-stream the file from the direct URL provided by RapidAPI.
    The frontend sends the direct download URL in the format_id field,
    so we just need to stream it back to the user.
    """
    download_url = payload.download_url
    if not download_url:
        raise HTTPException(status_code=400, detail="No download URL provided.")

    try:
        upstream = http_requests.get(download_url, stream=True, timeout=120)
        upstream.raise_for_status()
    except http_requests.RequestException:
        raise HTTPException(
            status_code=400,
            detail="The download failed. The content may have changed or is temporarily unavailable. Please try again.",
        )

    content_type = upstream.headers.get("Content-Type", "application/octet-stream")
    content_length = upstream.headers.get("Content-Length")

    # Build a filename from the format info
    ext = payload.format_type or "mp4"
    filename = f"saveroll_download.{ext}"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    if content_length:
        headers["Content-Length"] = content_length

    def stream_chunks():
        for chunk in upstream.iter_content(chunk_size=64 * 1024):
            if chunk:
                yield chunk

    return StreamingResponse(
        stream_chunks(),
        media_type=content_type,
        headers=headers,
    )
