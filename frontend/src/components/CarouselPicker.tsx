"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CarouselItem } from "@/types";

interface CarouselPickerProps {
  items: CarouselItem[];
  selectedIndex: number;   // 1-based
  onSelect: (index: number) => void;
  selectedIndices: number[];
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export default function CarouselPicker({
  items,
  selectedIndex,
  onSelect,
  selectedIndices,
  onToggleSelect,
  onSelectAll,
  onClearSelection
}: CarouselPickerProps) {
  return (
    <div className="pb-2">
      <div className="flex items-center justify-between px-6 pb-3">
        <p className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wide">
          {items.length} slides in this post
        </p>
        
        <div className="flex gap-2">
          {selectedIndices.length > 0 && (
            <button
              onClick={onClearSelection}
              className="text-[11px] bg-white/5 hover:bg-white/10 text-white/70 px-2.5 py-1 rounded-full transition-colors"
            >
              Clear
            </button>
          )}
          {selectedIndices.length !== items.length && (
            <button
              onClick={onSelectAll}
              className="text-[11px] bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 text-[var(--accent)] px-2.5 py-1 rounded-full transition-colors font-medium"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-6 pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {items.map((item) => {
          const isSelected = item.index === selectedIndex;
          const isBatchSelected = selectedIndices.includes(item.index);
          return (
            <motion.button
              key={item.index}
              onClick={() => onSelect(item.index)}
              whileTap={{ scale: 0.95 }}
              className={`relative flex-shrink-0 w-20 h-20 rounded-[var(--radius-inner)] overflow-hidden border-2 transition-all duration-200 ${
                isSelected
                  ? "border-white/50 shadow-lg scale-105"
                  : "border-white/10 hover:border-white/30"
              } ${isBatchSelected ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-transparent" : ""}`}
              aria-label={`Select carousel item ${item.index}`}
              aria-pressed={isSelected}
            >
              {/* Batch Select Checkbox */}
              <div 
                className="absolute top-1 right-1 z-10 p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(item.index);
                }}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors shadow-sm backdrop-blur-md ${
                  isBatchSelected ? "bg-[var(--accent)] text-white border border-[var(--accent)]" : "bg-black/40 border border-white/50 text-transparent hover:bg-black/60"
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Thumbnail */}
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt={`Item ${item.index}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <span className="text-white/30 text-xs">{item.index}</span>
                </div>
              )}

              {/* Item number badge */}
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
                {item.index}
              </div>

              {/* Media type badge */}
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded backdrop-blur-sm uppercase tracking-wide">
                {item.media_type === "video" ? "▶" : "📷"}
              </div>

              {/* Selection ring overlay (for the active viewing item) */}
              {isSelected && (
                <div className="absolute inset-0 bg-white/5 flex items-center justify-center pointer-events-none">
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
