"use client";

import { motion } from "framer-motion";
import { Download, Check, Loader2 } from "lucide-react";

interface DownloadButtonProps {
  onClick: () => void;
  status: "idle" | "downloading" | "done";
  progress: number;
  disabled?: boolean;
}

export default function DownloadButton({ onClick, status, progress, disabled }: DownloadButtonProps) {
  return (
    <div className="px-6 pb-6">
      <motion.button
        whileTap={{ scale: disabled || status !== "idle" ? 1 : 0.97 }}
        onClick={onClick}
        disabled={disabled || status !== "idle"}
        className="relative w-full overflow-hidden rounded-[var(--radius-inner)] bg-[var(--accent)] hover:bg-[var(--accent-pressed)] transition-colors text-white font-medium py-3 px-4 flex items-center justify-center gap-2 disabled:opacity-80 shadow-lg shadow-[var(--accent)]/20"
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
              <span>Download</span>
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
    </div>
  );
}
