import os
import shutil
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse

from extractor import (
    AccountGoneError,
    ContentNotFoundError,
    MediaExtractionError,
    PrivateContentError,
    download_media,
    extract_info,
)
from limiter import limiter
from models import DownloadRequest, InfoRequest, MediaInfo

router = APIRouter()

# Allow-list of domains yt-dlp is permitted to contact.
ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
    "instagram.com",
    "www.instagram.com",
}


def _validate_url(url: str) -> None:
    """Raise HTTPException if the URL is not a safe, allow-listed http/https URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="That doesn't look like a valid URL. Please double-check and try again.")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400, detail="Only YouTube and Instagram links are supported."
        )

    full_host = (parsed.hostname or "").lower()
    if full_host not in ALLOWED_HOSTS:
        raise HTTPException(
            status_code=400,
            detail="Only YouTube and Instagram links are supported. Please paste a valid link from either platform.",
        )


def _extraction_error_to_http(exc: MediaExtractionError) -> HTTPException:
    """Map our custom error hierarchy to the correct HTTP status code."""
    if isinstance(exc, PrivateContentError):
        return HTTPException(status_code=403, detail=str(exc))
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
@limiter.limit("5/minute")
def download(payload: DownloadRequest, background_tasks: BackgroundTasks, request: Request):
    _validate_url(payload.url)
    try:
        filepath = download_media(
            payload.url,
            payload.format_id,
            payload.format_type,
            carousel_index=payload.carousel_index,
        )
    except MediaExtractionError as exc:
        raise _extraction_error_to_http(exc)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The download failed. The content may have changed or is temporarily unavailable. Please try again.",
        )

    tmp_dir = os.path.dirname(filepath)
    background_tasks.add_task(shutil.rmtree, tmp_dir, True)

    return FileResponse(
        path=filepath,
        filename=os.path.basename(filepath),
        media_type="application/octet-stream",
        background=background_tasks,
    )
