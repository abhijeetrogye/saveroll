"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CarouselItem } from "@/types";

interface CarouselPickerProps {
  items: CarouselItem[];
  selectedIndex: number;   // 1-based
  onSelect: (index: number) => void;
}

export default function CarouselPicker({
  items,
  selectedIndex,
  onSelect,
}: CarouselPickerProps) {
  return (
    <div className="px-6 pb-2">
      <p className="text-xs text-[var(--text-secondary)] mb-2 font-medium uppercase tracking-wide">
        {items.length} items in this post — pick one to download
      </p>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {items.map((item) => {
          const isSelected = item.index === selectedIndex;
          return (
            <motion.button
              key={item.index}
              onClick={() => onSelect(item.index)}
              whileTap={{ scale: 0.95 }}
              className={`relative flex-shrink-0 w-20 h-20 rounded-[var(--radius-inner)] overflow-hidden border-2 transition-all duration-200 ${
                isSelected
                  ? "border-[var(--accent)] shadow-lg shadow-[var(--accent)]/30 scale-105"
                  : "border-white/10 hover:border-white/30"
              }`}
              aria-label={`Select carousel item ${item.index}`}
              aria-pressed={isSelected}
            >
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

              {/* Selection ring overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-[var(--accent)]/10 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-md">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
