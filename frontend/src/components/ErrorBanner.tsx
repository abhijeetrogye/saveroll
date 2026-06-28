"use client";

import { AlertCircle, ExternalLink } from "lucide-react";
import { ApiError } from "@/types";

interface ErrorBannerProps {
  error: ApiError | null;
}

export default function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="px-6 pb-6">
      <div className="flex flex-col gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[var(--radius-inner)] text-red-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{error.detail}</p>
        </div>
        
        {error.fallbackUrl && (
          <div className="ml-8 mt-1">
            <a
              href={error.fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/10"
            >
              Try Direct Download <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
