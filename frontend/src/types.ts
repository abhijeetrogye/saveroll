export type MediaFormat = {
  format_id: string;
  ext: string;
  type: "video" | "video_only" | "audio" | "image";
  resolution?: string;
  fps?: number;
  abr?: number;
  filesize: number;
  filesize_is_estimate: boolean;
  note: string;
};

/** One slide in a multi-item carousel (e.g. an Instagram album post). */
export type CarouselItem = {
  index: number;           // 1-based position in the carousel
  thumbnail?: string | null;
  media_type: "video" | "image";
  formats: MediaFormat[];
};

export type MediaInfo = {
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
  source: "youtube" | "instagram" | "other";
  media_type: "video" | "image" | "carousel";
  formats: MediaFormat[];         // Empty when carousel_items is populated
  carousel_items?: CarouselItem[];
};

export type ApiError = {
  detail: string;
};
