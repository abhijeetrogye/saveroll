import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generate a static site (index.html + assets) for Netlify deployment
  output: "export",
  // Next.js image optimization requires a server — disable for static export
  images: {
    unoptimized: true,
    remotePatterns: [
      // YouTube thumbnails
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      // Instagram CDN (multiple domains used by Meta)
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
    ],
  },
};

export default nextConfig;
