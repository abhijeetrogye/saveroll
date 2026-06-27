"use client";

import { motion } from "framer-motion";

export default function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-4"
    >
      <div className="flex gap-4 items-center">
        <div className="w-24 h-24 rounded-lg bg-white/10 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-10 w-full bg-white/10 rounded-full animate-pulse" />
    </motion.div>
  );
}
