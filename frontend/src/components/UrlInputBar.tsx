"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

interface UrlInputBarProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function UrlInputBar({ onSubmit, isLoading }: UrlInputBarProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const getIcon = () => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return <YoutubeIcon className="w-5 h-5 text-[#ff0000]" />;
    }
    if (url.includes("instagram.com")) {
      return <InstagramIcon className="w-5 h-5 text-[#E1306C]" />;
    }
    return <Link2 className="w-5 h-5 text-gray-400" />;
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center w-full p-2">
      <div className="pl-3 pr-2 flex items-center justify-center">
        {getIcon()}
      </div>
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube or Instagram link..."
        className="flex-1 min-w-0 text-sm sm:text-base bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] px-2 py-2"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 text-[var(--text-primary)]"
        aria-label="Fetch formats"
      >
        <ArrowRight className="w-5 h-5" />
      </button>
    </form>
  );
}
