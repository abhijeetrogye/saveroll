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
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export default function Home() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<MediaFormat[]>([]);
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
    setSelectedFormats([]);
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
        const defaultFmt = pickDefaultFormat(formats);
        setSelectedFormat(defaultFmt);
        setSelectedFormats(defaultFmt ? [defaultFmt] : []);
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
      const defaultFmt = pickDefaultFormat(formats);
      setSelectedFormat(defaultFmt);
      setSelectedFormats(defaultFmt ? [defaultFmt] : []);
    }
    // Clear any previous download errors when switching items
    setError(null);
    setDownloadStatus("idle");
  };

  /** Download a single file via the proxy endpoint. */
  const downloadSingleFile = async (format: MediaFormat): Promise<boolean> => {
    const isCarousel = mediaInfo?.media_type === "carousel";

    const res = await fetch(`${API_BASE}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: currentUrl,
        format_id: format.format_id,
        format_type: format.ext,
        carousel_index: isCarousel ? selectedCarouselIndex : 0,
        download_url: format.download_url || "",
      }),
    });

    if (!res.ok) {
      const errorData = await res
        .json()
        .catch(() => ({ detail: "Download failed." }));
      setError(errorData);
      return false;
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
      }${suffix}.${format.ext}`;
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    return true;
  };

  /** Download selected formats (sequentially for individual files). */
  const handleDownload = async () => {
    const formatsToDownload = selectedFormats.length > 0 ? selectedFormats : (selectedFormat ? [selectedFormat] : []);
    if (!currentUrl || formatsToDownload.length === 0) return;

    setDownloadStatus("downloading");
    setDownloadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < formatsToDownload.length; i++) {
        setDownloadProgress((i / formatsToDownload.length) * 100);
        const success = await downloadSingleFile(formatsToDownload[i]);
        if (!success) {
          setDownloadStatus("idle");
          return;
        }
      }

      setDownloadStatus("done");
      setTimeout(() => setDownloadStatus("idle"), 3000);
    } catch (e) {
      console.error("[Saveroll] handleDownload error:", e);
      setError({ detail: "An error occurred during download." });
      setDownloadStatus("idle");
    }
  };

  /** Download all selected formats as a single ZIP archive. */
  const handleZipDownload = async () => {
    if (!currentUrl || selectedFormats.length === 0) return;

    setDownloadStatus("downloading");
    setDownloadProgress(0);
    setError(null);

    const titleSlug = mediaInfo?.title?.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "media";

    try {
      const res = await fetch(`${API_BASE}/api/download-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          items: selectedFormats.map((f, i) => ({
            download_url: f.download_url || "",
            filename: `${titleSlug}_${f.note || f.format_id}`.replace(/[^a-z0-9_]/gi, "_"),
            ext: f.ext,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: "ZIP download failed." }));
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

      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "saveroll_downloads.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadStatus("done");
      setTimeout(() => setDownloadStatus("idle"), 3000);
    } catch (e) {
      console.error("[Saveroll] handleZipDownload error:", e);
      setError({ detail: "An error occurred during ZIP download." });
      setDownloadStatus("idle");
    }
  };

  const isExpanded = isLoading || mediaInfo !== null || error !== null;
  const isCarousel = mediaInfo?.media_type === "carousel";
  const activeFormats = getActiveFormats(mediaInfo, selectedCarouselIndex);

  return (
    <>
      <SplashScreen />
      <div className="min-h-[100dvh] flex flex-col w-full max-w-7xl mx-auto relative z-10">
        <main className="flex-1 flex flex-col items-center px-4 pt-6 sm:pt-10 pb-6">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 sm:mb-10"
        >
          <Image
            src="/logo.png"
            alt="Saveroll logo"
            width={500}
            height={120}
            priority
            className="object-contain w-auto h-20 sm:h-28"
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
                  selectedFormats={selectedFormats}
                  onSelect={setSelectedFormat}
                  onSelectMulti={setSelectedFormats}
                />

                {error && <ErrorBanner error={error} />}

                <DownloadButton
                  onClick={handleDownload}
                  onZipDownload={selectedFormats.length > 1 ? handleZipDownload : undefined}
                  status={downloadStatus}
                  progress={downloadProgress}
                  disabled={selectedFormats.length === 0 && !selectedFormat}
                  selectedCount={selectedFormats.length}
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
        </main>
        <Footer />
      </div>
    </>
  );
}
