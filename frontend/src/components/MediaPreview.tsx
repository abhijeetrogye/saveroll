"use client";

import { useState } from "react";
import Image from "next/image";
import { MediaInfo } from "@/types";
import { Clock, Link2, Copy, Check, Download } from "lucide-react";

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

interface MediaPreviewProps {
  info: MediaInfo;
}

export default function MediaPreview({ info }: MediaPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = info.description || info.title;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadThumbnail = async () => {
    if (!info.thumbnail) return;
    try {
      const response = await fetch(info.thumbnail);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `thumbnail_${(info.title || "media").substring(0, 20).replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      window.open(info.thumbnail, "_blank");
    }
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds <= 0 || info.media_type === "carousel") return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const durationLabel = formatDuration(info.duration);

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-6 pb-4">
      <div className="relative w-full sm:w-32 aspect-video sm:aspect-square rounded-[var(--radius-inner)] overflow-hidden flex-shrink-0 bg-black/50 group">
        {info.thumbnail ? (
          <Image
            src={info.thumbnail}
            alt={info.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 128px"
            unoptimized={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
            No preview
          </div>
        )}
        {info.thumbnail && (
          <button
            onClick={handleDownloadThumbnail}
            className="absolute top-2 left-2 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white p-1.5 rounded backdrop-blur-md hover:bg-black/90 z-10"
            title="Download Thumbnail"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {durationLabel && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-md">
            <Clock className="w-3 h-3" />
            {durationLabel}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0 py-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-medium text-[var(--text-primary)] line-clamp-2" title={info.title}>
            {info.title}
          </h2>
          <button
            onClick={handleCopy}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[var(--text-secondary)] hover:text-white transition-colors shrink-0"
            title="Copy caption"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {info.description && info.description !== info.title && (
          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2" title={info.description}>
            {info.description}
          </p>
        )}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mt-2">
          {info.source === "youtube" ? (
            <YoutubeIcon className="w-4 h-4 text-[#ff0000]" />
          ) : info.source === "instagram" ? (
            <InstagramIcon className="w-4 h-4 text-[#E1306C]" />
          ) : (
            <Link2 className="w-4 h-4 text-blue-400" />
          )}
          {info.uploader && <span className="truncate">{info.uploader}</span>}
        </div>
      </div>
    </div>
  );
}
