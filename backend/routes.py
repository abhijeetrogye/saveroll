import io
import os
import zipfile
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
from models import BatchDownloadRequest, DownloadRequest, InfoRequest, MediaInfo

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
    If the download URL has expired, automatically re-fetch from RapidAPI
    to get a fresh URL and retry once.
    """
    download_url = payload.download_url
    if not download_url:
        raise HTTPException(status_code=400, detail="No download URL provided.")

    upstream = None
    try:
        upstream = http_requests.get(download_url, stream=True, timeout=120)
        upstream.raise_for_status()
    except http_requests.RequestException:
        # URL likely expired — try to re-fetch fresh download URLs from RapidAPI
        upstream = None

    if upstream is None:
        try:
            fresh_info = extract_info(payload.url)
            # Find a matching format by format_id or type
            fresh_url = None
            for fmt in fresh_info.formats:
                if fmt.format_id == payload.format_id and fmt.download_url:
                    fresh_url = fmt.download_url
                    break
            # Fallback: match by extension + type
            if not fresh_url:
                for fmt in fresh_info.formats:
                    if fmt.ext == payload.format_type and fmt.download_url:
                        fresh_url = fmt.download_url
                        break
            if not fresh_url:
                raise HTTPException(
                    status_code=400,
                    detail="Download link expired and we couldn't get a fresh one. Please re-paste the URL and try again.",
                )
            try:
                upstream = http_requests.get(fresh_url, stream=True, timeout=120)
                upstream.raise_for_status()
            except http_requests.RequestException:
                raise HTTPException(
                    status_code=400,
                    detail="The server was blocked from downloading this file. Please try the Direct Download Link below.",
                )
        except MediaExtractionError:
            raise HTTPException(
                status_code=400,
                detail="Download link expired. Please re-paste the URL and try again.",
            )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="The download failed because the server was blocked. Please try the Direct Download Link below.",
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


@router.post("/api/download-zip")
@limiter.limit("5/minute")
def download_zip(payload: BatchDownloadRequest, request: Request):
    """
    Fetch multiple files and stream them back as a single ZIP archive.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to download.")
    if len(payload.items) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 items per ZIP download.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, item in enumerate(payload.items):
            if not item.download_url:
                continue
            try:
                resp = http_requests.get(item.download_url, stream=True, timeout=60)
                resp.raise_for_status()
                file_data = resp.content
                safe_name = item.filename.replace("/", "_").replace("\\", "_")
                entry_name = f"{safe_name}_{i + 1}.{item.ext}"
                zf.writestr(entry_name, file_data)
            except http_requests.RequestException:
                # Skip items that fail to download — don't block the whole ZIP
                continue

    buf.seek(0)
    zip_bytes = buf.getvalue()

    if not zip_bytes or len(zip_bytes) <= 22:  # Empty ZIP is ~22 bytes
        raise HTTPException(
            status_code=400,
            detail="None of the files could be downloaded. The server might be blocked by the provider.",
        )

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="saveroll_downloads.zip"',
            "Content-Length": str(len(zip_bytes)),
        },
    )
