from pydantic import BaseModel
from typing import List, Optional


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_id: str
    format_type: str
    carousel_index: int = 0  # 0 = top-level (non-carousel); 1-based for carousel items
    download_url: str = ""   # Direct download URL from RapidAPI


class FormatOption(BaseModel):
    format_id: str
    ext: str
    type: str
    resolution: Optional[str] = None
    fps: Optional[float] = None
    abr: Optional[float] = None
    filesize: Optional[int] = 0
    filesize_is_estimate: Optional[bool] = False
    note: Optional[str] = ""
    download_url: Optional[str] = None


# Alias so routes.py can also import as MediaFormat
MediaFormat = FormatOption


class CarouselItem(BaseModel):
    """One slide in a multi-image/video carousel (e.g. Instagram album post)."""
    index: int                          # 1-based position in the carousel
    thumbnail: Optional[str] = None
    media_type: str                     # "video" | "image"
    formats: List[FormatOption]


class MediaInfo(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    uploader: Optional[str] = None
    source: str
    media_type: str
    formats: List[FormatOption]         # Empty when carousel_items is populated
    carousel_items: List[CarouselItem] = []
