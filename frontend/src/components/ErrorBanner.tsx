"use client";

import { AlertCircle } from "lucide-react";
import { ApiError } from "@/types";

interface ErrorBannerProps {
  error: ApiError | null;
}

export default function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="px-6 pb-6">
      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[var(--radius-inner)] text-red-200">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">{error.detail}</p>
      </div>
    </div>
  );
}
