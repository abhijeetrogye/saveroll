"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import MorphCard from "@/components/MorphCard";
import UrlInputBar from "@/components/UrlInputBar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import MediaPreview from "@/components/MediaPreview";
import CarouselPicker from "@/components/CarouselPicker";
import FormatPicker from "@/components/FormatPicker";
import DownloadButton from "@/components/DownloadButton";
import ErrorBanner from "@/components/ErrorBanner";
import Footer from "@/components/Footer";
import SplashScreen from "@/components/SplashScreen";
import { MediaInfo, MediaFormat, CarouselItem, ApiError } from "@/types";
import { AnimatePresence, motion } from "framer-motion";

// Resolved once at module load — no re-computation on every render.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [selectedCarouselIndex, setSelectedCarouselIndex] = useState<number>(1); // 1-based
  const [error, setError] = useState<ApiError | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "done">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);

  /** Formats relevant to the currently selected carousel item (or top-level for non-carousels). */
  const getActiveFormats = useCallback(
    (info: MediaInfo | null, carouselIndex: number): MediaFormat[] => {
      if (!info) return [];
      const isCarousel = info.media_type === "carousel" && info.carousel_items?.length;
      if (isCarousel) {
        const item = info.carousel_items!.find((c) => c.index === carouselIndex);
        return item?.formats ?? [];
      }
      return info.formats;
    },
    []
  );

  const pickDefaultFormat = (formats: MediaFormat[]): MediaFormat | null => {
    if (!formats.length) return null;
    const videoFormats = formats.filter((f) => f.type.startsWith("video"));
    return videoFormats.length > 0 ? videoFormats[0] : formats[0];
  };

  const fetchInfo = async (url: string) => {
    setCurrentUrl(url);
    setIsLoading(true);
    setError(null);
    setMediaInfo(null);
    setSelectedFormat(null);
    setSelectedCarouselIndex(1);
    setDownloadStatus("idle");
    setDownloadProgress(0);

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: "An unknown error occurred." }));
        setError(errorData);
      } else {
        const data: MediaInfo = await res.json();
        setMediaInfo(data);
        // Auto-select the first format of the first carousel item (or top-level).
        const formats = getActiveFormats(data, 1);
        setSelectedFormat(pickDefaultFormat(formats));
      }
    } catch (e) {
      console.error("[Saveroll] fetchInfo error:", e);
      setError({ detail: "Network error. Make sure the backend is running." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCarouselSelect = (index: number) => {
    setSelectedCarouselIndex(index);
    if (mediaInfo) {
      const formats = getActiveFormats(mediaInfo, index);
      setSelectedFormat(pickDefaultFormat(formats));
    }
    // Clear any previous download errors when switching items
    setError(null);
    setDownloadStatus("idle");
  };

  const handleDownload = async () => {
    if (!currentUrl || !selectedFormat) return;

    setDownloadStatus("downloading");
    setDownloadProgress(0);
    setError(null);

    const isCarousel = mediaInfo?.media_type === "carousel";

    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          format_id: selectedFormat.format_id,
          format_type: selectedFormat.type,
          carousel_index: isCarousel ? selectedCarouselIndex : 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: "Download failed." }));
        setError(errorData);
        setDownloadStatus("idle");
        return;
      }

      if (!res.body) {
        throw new Error("No response body received from server.");
      }

      const contentLength = res.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      let loaded = 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total > 0) {
            setDownloadProgress((loaded / total) * 100);
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      const disposition = res.headers.get("Content-Disposition");
      let filename = "download";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      } else {
        const suffix = isCarousel ? `_item${selectedCarouselIndex}` : "";
        filename = `${
          mediaInfo?.title?.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "media"
        }${suffix}.${selectedFormat.ext}`;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadStatus("done");
      setTimeout(() => setDownloadStatus("idle"), 3000);
    } catch (e) {
      console.error("[Saveroll] handleDownload error:", e);
      setError({ detail: "An error occurred during download." });
      setDownloadStatus("idle");
    }
  };

  const isExpanded = isLoading || mediaInfo !== null || error !== null;
  const isCarousel = mediaInfo?.media_type === "carousel";
  const activeFormats = getActiveFormats(mediaInfo, selectedCarouselIndex);

  return (
    <>
      <SplashScreen />
      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-[100dvh] w-full max-w-7xl mx-auto relative z-10">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Image
            src="/logo.png"
            alt="Saveroll logo"
            width={400}
            height={96}
            priority
            className="object-contain w-auto h-24"
          />
        </motion.div>

        <MorphCard isExpanded={isExpanded}>
          <UrlInputBar onSubmit={fetchInfo} isLoading={isLoading} />

          <AnimatePresence mode="wait">
            {isLoading ? (
              <LoadingSkeleton key="loading" />
            ) : mediaInfo ? (
              <motion.div
                key="content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <MediaPreview info={mediaInfo} />

                {/* Carousel item selector — shown only for multi-item posts */}
                {isCarousel && mediaInfo.carousel_items && (
                  <CarouselPicker
                    items={mediaInfo.carousel_items}
                    selectedIndex={selectedCarouselIndex}
                    onSelect={handleCarouselSelect}
                  />
                )}

                <FormatPicker
                  formats={activeFormats}
                  selectedFormat={selectedFormat}
                  onSelect={setSelectedFormat}
                />

                {error && <ErrorBanner error={error} />}

                <DownloadButton
                  onClick={handleDownload}
                  status={downloadStatus}
                  progress={downloadProgress}
                  disabled={!selectedFormat}
                />
              </motion.div>
            ) : error ? (
              <motion.div
                key="error-only"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="pt-2"
              >
                <ErrorBanner error={error} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </MorphCard>
        <Footer />
      </main>
    </>
  );
}
