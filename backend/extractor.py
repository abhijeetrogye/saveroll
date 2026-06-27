import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import yt_dlp

from models import CarouselItem, FormatOption, MediaInfo


# ---------------------------------------------------------------------------
# Shared yt-dlp base options
# ---------------------------------------------------------------------------

BASE_OPTS: Dict[str, Any] = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "socket_timeout": 30,
}


# ---------------------------------------------------------------------------
# Custom exception hierarchy for clear HTTP error mapping
# ---------------------------------------------------------------------------

class MediaExtractionError(Exception):
    """Base class — carry an http_status so routes can return the right code."""
    http_status: int = 400


class PrivateContentError(MediaExtractionError):
    """Content exists but requires authentication / is from a private account."""
    http_status: int = 403


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
    return "other"


def _height_from_resolution(resolution: Optional[str]) -> int:
    if not resolution or "x" not in resolution:
        return 0
    try:
        return int(resolution.split("x")[1])
    except (ValueError, IndexError):
        return 0


def _classify_ydlp_error(exc: Exception) -> MediaExtractionError:
    """
    Inspect a yt-dlp exception message and return the most specific
    MediaExtractionError subclass with a user-friendly message.
    """
    msg = str(exc).lower()

    # Instagram-specific: empty response / login wall
    if "empty media response" in msg or (
        "instagram" in msg and any(p in msg for p in (
            "check if this post is accessible",
            "without being logged-in",
            "cookies",
        ))
    ):
        return PrivateContentError(
            "Instagram requires a login to access this post. "
            "Only public posts that are visible without logging in can be downloaded."
        )

    # Private / login-required
    if any(p in msg for p in (
        "private video",
        "this video is private",
        "login required",
        "login_required",
        "not accessible",
        "this media is not accessible",
        "requires authentication",
        "private account",
        "sorry, this media",
    )):
        return PrivateContentError(
            "This content requires a login. Posts from private accounts cannot be downloaded."
        )

    # Removed / unavailable
    if any(p in msg for p in (
        "video unavailable",
        "not available",
        "this video has been removed",
        "has been deleted",
        "no longer available",
        "content not found",
        "404",
    )):
        return ContentNotFoundError(
            "This content is no longer available or has been removed."
        )

    # Account terminated / disabled
    if any(p in msg for p in (
        "account has been disabled",
        "account was terminated",
        "channel has been terminated",
        "account suspended",
    )):
        return AccountGoneError(
            "This account no longer exists. The content cannot be retrieved."
        )

    # Unsupported URL / extractor
    if any(p in msg for p in (
        "unsupported url",
        "no video formats",
        "unable to extract",
    )):
        return MediaExtractionError(
            "This link type isn't supported. Try a direct video or post link."
        )

    # Generic fallback
    return MediaExtractionError(
        "We couldn't read that link. It may be private, region-locked, or temporarily unavailable. Please try again."
    )


def _build_formats(raw: Dict[str, Any]) -> Tuple[List[FormatOption], str]:
    """
    Parse yt-dlp's raw info dict for one media item and return
    (sorted_formats, media_type).
    """
    duration = raw.get("duration")
    formats: List[FormatOption] = []
    seen_keys: set = set()

    for f in raw.get("formats", []):
        if f.get("format_note") == "storyboard":
            continue

        has_video = f.get("vcodec") not in (None, "none")
        has_audio = f.get("acodec") not in (None, "none")

        if has_video and has_audio:
            ftype = "video"
            label = f.get("format_note") or f"{f.get('height', '?')}p"
        elif has_video:
            ftype = "video_only"
            note = f.get("format_note")
            height = f.get("height")
            
            if note and str(note).endswith("p"):
                base_label = note
            elif height:
                base_label = f"{height}p"
            else:
                base_label = f"{note or '?'}p"
                
            label = f"{base_label} · with audio"
        elif has_audio:
            ftype = "audio"
            abr = f.get("abr")
            label = f"{int(abr)}kbps audio" if abr else "audio"
        else:
            continue

        dedupe_key = (ftype, label, f.get("ext"))
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        filesize = f.get("filesize")
        is_estimate = False
        if not filesize and f.get("filesize_approx"):
            filesize = f.get("filesize_approx")
            is_estimate = True
        if not filesize and f.get("tbr") and duration:
            filesize = int(f["tbr"] * 1000 * duration / 8)
            is_estimate = True

        formats.append(
            FormatOption(
                format_id=str(f["format_id"]),
                ext=f.get("ext", "mp4"),
                type=ftype,
                resolution=f.get("resolution") if has_video else None,
                fps=f.get("fps") if has_video else None,
                abr=f.get("abr") if has_audio else None,
                filesize=filesize or 0,
                filesize_is_estimate=is_estimate,
                note=label,
            )
        )

    media_type = "video"
    if not formats:
        # Plain image post (e.g. Instagram photo).
        if raw.get("url"):
            formats.append(
                FormatOption(
                    format_id=str(raw.get("format_id", "0")),
                    ext=raw.get("ext", "jpg"),
                    type="image",
                    filesize=raw.get("filesize") or raw.get("filesize_approx") or 0,
                    filesize_is_estimate=not bool(raw.get("filesize")),
                    note="Image",
                )
            )
            media_type = "image"

    def sort_key(fo: FormatOption):
        type_order = {"video": 0, "video_only": 1, "audio": 2, "image": 3}
        return (
            type_order.get(fo.type, 9),
            -_height_from_resolution(fo.resolution),
            -(fo.abr or 0),
        )

    formats.sort(key=sort_key)
    return formats, media_type


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_info(url: str) -> MediaInfo:
    """Fetch metadata + available formats without downloading anything."""
    opts = {**BASE_OPTS, "skip_download": True, "noplaylist": False}

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            raw = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise _classify_ydlp_error(exc) from exc

    if not raw:
        raise MediaExtractionError("No info returned for this URL.")

    # -----------------------------------------------------------------------
    # Carousel / playlist detection (Instagram album, YouTube playlist, etc.)
    # -----------------------------------------------------------------------
    if raw.get("_type") == "playlist" and raw.get("entries"):
        entries = [e for e in raw["entries"] if e]  # filter None entries

        # Use the first entry as the representative for top-level metadata.
        first = entries[0]

        carousel_items: List[CarouselItem] = []
        for i, entry in enumerate(entries, start=1):
            item_formats, item_media_type = _build_formats(entry)
            carousel_items.append(
                CarouselItem(
                    index=i,
                    thumbnail=entry.get("thumbnail"),
                    media_type=item_media_type,
                    formats=item_formats,
                )
            )

        return MediaInfo(
            title=raw.get("title") or first.get("title") or "Untitled",
            thumbnail=first.get("thumbnail"),
            duration=None,          # Carousels have no single duration
            uploader=raw.get("uploader") or raw.get("channel") or first.get("uploader"),
            source=detect_source(url),
            media_type="carousel",
            formats=[],             # Formats are per-item; see carousel_items
            carousel_items=carousel_items,
        )

    # -----------------------------------------------------------------------
    # Single item (video, audio, or plain image)
    # -----------------------------------------------------------------------
    formats, media_type = _build_formats(raw)

    return MediaInfo(
        title=raw.get("title") or "Untitled",
        thumbnail=raw.get("thumbnail"),
        duration=raw.get("duration"),
        uploader=raw.get("uploader") or raw.get("channel") or "Unknown",
        source=detect_source(url),
        media_type=media_type,
        formats=formats,
        carousel_items=[],
    )


def download_media(url: str, format_id: str, format_type: str, carousel_index: int = 0) -> str:
    """
    Downloads the chosen format to a temp directory and returns the file path.
    carousel_index: 0 = regular (non-carousel) download; 1-based index for carousel items.
    Caller is responsible for cleaning up the temp directory after sending the response.
    """
    tmp_dir = tempfile.mkdtemp(prefix="saveroll_dl_")
    outtmpl = os.path.join(tmp_dir, "%(title).80s.%(ext)s")

    # For carousel items, allow playlist extraction so we can reach the nth entry.
    allow_playlist = carousel_index > 0

    opts = {
        **BASE_OPTS,
        "outtmpl": outtmpl,
        "noplaylist": not allow_playlist,
    }

    if format_type == "video_only":
        opts["format"] = f"{format_id}+bestaudio/best"
        opts["merge_output_format"] = "mp4"
    else:
        opts["format"] = format_id

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

            # For carousels pick the correct entry (carousel_index is 1-based).
            if info.get("_type") == "playlist" and info.get("entries"):
                entries = [e for e in info["entries"] if e]
                idx = (carousel_index - 1) if carousel_index > 0 else 0
                idx = max(0, min(idx, len(entries) - 1))
                info = entries[idx]

            filename = ydl.prepare_filename(info)

            # After merge, yt-dlp may change the extension — scan disk for the real file.
            if not os.path.exists(filename):
                base = os.path.splitext(filename)[0]
                for ext in (".mp4", ".mkv", ".webm", ".m4a", ".mp3", ".jpg", ".png"):
                    candidate = base + ext
                    if os.path.exists(candidate):
                        filename = candidate
                        break

        return filename

    except Exception as exc:
        # Always clean up temp dir on any failure to prevent disk leaks.
        shutil.rmtree(tmp_dir, ignore_errors=True)
        # Re-raise as a classified error so routes can map the right HTTP code.
        raise _classify_ydlp_error(exc) from exc
