"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MediaFormat } from "@/types";

interface FormatPickerProps {
  formats: MediaFormat[];
  selectedFormat: MediaFormat | null;
  onSelect: (format: MediaFormat) => void;
}

function getDefaultTab(formats: MediaFormat[]): "video" | "audio" | "image" {
  if (formats.some((f) => f.type.startsWith("video"))) return "video";
  if (formats.some((f) => f.type === "audio")) return "audio";
  return "image";
}

function getFriendlyResolutionName(res: string | undefined): string {
  if (!res) return "Unknown";
  const parts = res.split("x");
  if (parts.length === 2) {
    const w = parseInt(parts[0]);
    const h = parseInt(parts[1]);
    const minDim = Math.min(w, h); // Use min dimension to handle vertical videos gracefully
    
    if (minDim >= 4320) return "8K Ultra HD";
    if (minDim >= 2160) return "4K Ultra HD";
    if (minDim >= 1440) return "2K QHD";
    if (minDim >= 1080) return "Full HD";
    if (minDim >= 720) return "HD";
    return "SD";
  }
  return res;
}

function getFriendlyAudioName(abr: number | null | undefined, ext: string): string {
  if (!abr) return ext.toUpperCase() + " Audio";
  if (abr >= 320) return "Studio Quality";
  if (abr >= 256) return "High Quality";
  if (abr >= 128) return "Standard Quality";
  return "Basic Quality";
}

export default function FormatPicker({ formats, selectedFormat, onSelect }: FormatPickerProps) {
  const videoFormats = formats.filter((f) => f.type.startsWith("video"));
  const audioFormats = formats.filter((f) => f.type === "audio");
  const imageFormats = formats.filter((f) => f.type === "image");

  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image">(
    getDefaultTab(formats)
  );

  // Reset the active tab whenever a new set of formats is loaded.
  // This prevents the tab staying on "video" when switching to an audio-only URL.
  useEffect(() => {
    setActiveTab(getDefaultTab(formats));
  }, [formats]);

  const activeFormats =
    activeTab === "video" ? videoFormats : activeTab === "audio" ? audioFormats : imageFormats;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "Unknown size";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="px-6 pb-6 border-t border-white/10 pt-4 mt-2">
      <div className="flex flex-wrap sm:flex-nowrap justify-center gap-2 mb-4 bg-white/5 p-1 rounded-2xl sm:rounded-full w-fit max-w-full mx-auto border border-white/10">
        {videoFormats.length > 0 && (
          <button
            onClick={() => setActiveTab("video")}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === "video" ? "text-white" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            }`}
          >
            {activeTab === "video" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-full glass-btn-active"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Video</span>
          </button>
        )}
        {audioFormats.length > 0 && (
          <button
            onClick={() => setActiveTab("audio")}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === "audio" ? "text-white" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            }`}
          >
            {activeTab === "audio" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-full glass-btn-active"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Audio</span>
          </button>
        )}
        {imageFormats.length > 0 && (
          <button
            onClick={() => setActiveTab("image")}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === "image" ? "text-white" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            }`}
          >
            {activeTab === "image" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-full glass-btn-active"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Image</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {activeFormats.map((format) => (
          <button
            key={format.format_id}
            onClick={() => onSelect(format)}
            className={`flex flex-col text-left p-3 rounded-[var(--radius-inner)] transition-all ${
              selectedFormat?.format_id === format.format_id
                ? "glass-btn-active"
                : "glass-btn"
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="font-medium text-sm text-[var(--text-primary)]">
                {format.type.startsWith("video") && format.resolution
                  ? getFriendlyResolutionName(format.resolution)
                  : format.type === "audio"
                  ? getFriendlyAudioName(format.abr, format.ext)
                  : format.ext.toUpperCase()}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {format.filesize_is_estimate ? "~" : ""}
                {formatBytes(format.filesize)}
              </span>
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1 truncate w-full" title={format.note}>
              {format.note}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
