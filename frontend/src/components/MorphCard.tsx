"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MorphCardProps {
  isExpanded: boolean;
  children: ReactNode;
}

export default function MorphCard({ isExpanded, children }: MorphCardProps) {
  return (
    <motion.div
      layout
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`overflow-hidden transition-shadow duration-500 ${
        isExpanded ? "glass-thick w-full max-w-2xl" : "glass w-full max-w-md"
      }`}
      style={{
        borderRadius: isExpanded ? "var(--radius-outer)" : "9999px" // Use full pill shape when not expanded
      }}
    >
      {children}
    </motion.div>
  );
}
