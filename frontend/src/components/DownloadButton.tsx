"use client";

import { motion } from "framer-motion";
import { Download, Check, Loader2, Archive } from "lucide-react";

interface DownloadButtonProps {
  onClick: () => void;
  onZipDownload?: () => void;
  status: "idle" | "downloading" | "done";
  progress: number;
  disabled?: boolean;
  selectedCount: number;
}

export default function DownloadButton({
  onClick,
  onZipDownload,
  status,
  progress,
  disabled,
  selectedCount,
}: DownloadButtonProps) {
  const showZipOption = selectedCount > 1 && onZipDownload;
  const label =
    selectedCount > 1
      ? `Download ${selectedCount} files`
      : "Download";

  return (
    <div className="px-6 pb-6">
      {/* Primary download button */}
      <motion.button
        whileTap={{ scale: disabled || status !== "idle" ? 1 : 0.97 }}
        onClick={onClick}
        disabled={disabled || status !== "idle"}
        className="relative w-full overflow-hidden rounded-[var(--radius-inner)] btn-download text-white font-medium py-3 px-4 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
      >
        {status === "downloading" && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        )}
        
        <div className="relative flex items-center gap-2 z-10">
          {status === "idle" && (
            <>
              <Download className="w-5 h-5" />
              <span>{label}</span>
            </>
          )}
          {status === "downloading" && (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Downloading... {Math.round(progress)}%</span>
            </>
          )}
          {status === "done" && (
            <>
              <Check className="w-5 h-5" />
              <span>Saved!</span>
            </>
          )}
        </div>
      </motion.button>

      {/* ZIP download option — visible when multiple formats are selected */}
      {showZipOption && status === "idle" && (
        <motion.button
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={onZipDownload}
          disabled={disabled}
          className="w-full mt-2 rounded-[var(--radius-inner)] btn-download-secondary text-white/90 font-medium py-2.5 px-4 flex items-center justify-center gap-2"
        >
          <Archive className="w-4 h-4" />
          <span>Download as ZIP</span>
        </motion.button>
      )}
    </div>
  );
}
