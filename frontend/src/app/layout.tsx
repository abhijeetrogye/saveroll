import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const SITE_URL = "https://saveroll.netlify.app";
const SITE_NAME = "Saveroll";
const SITE_TITLE = "Saveroll — Free YouTube & Instagram Video Downloader";
const SITE_DESCRIPTION =
  "Download YouTube videos, Instagram Reels, and Stories in HD, Full HD, 4K, and audio-only formats. Free, fast, and no sign-up required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // Core intent
    "youtube video downloader",
    "instagram video downloader",
    "download youtube video",
    "download instagram reel",
    "download instagram story",
    "youtube to mp4",
    "youtube to mp3",
    "instagram to mp4",
    // Quality-specific
    "download youtube 1080p",
    "download youtube 4k",
    "download youtube hd",
    "youtube audio downloader",
    // Feature-based
    "free video downloader",
    "online video downloader",
    "no watermark video downloader",
    "video downloader without login",
    "fast video downloader",
    // Brand
    "saveroll",
    "saveroll downloader",
  ],
  authors: [{ name: "Abhijeet Rogye", url: "https://github.com/abhijeetrogye" }],
  creator: "Abhijeet Rogye",
  publisher: SITE_NAME,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: "Saveroll — Video Downloader",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/favicon.png"],
    creator: "@abhijeetrogye",
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
    shortcut: "/favicon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

// JSON-LD Structured Data — helps Google show rich results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Download YouTube videos in HD, Full HD, 4K",
    "Download Instagram Reels and Stories",
    "Extract audio from YouTube videos",
    "No account required",
    "Free to use",
  ],
  author: {
    "@type": "Person",
    name: "Abhijeet Rogye",
    url: "https://github.com/abhijeetrogye",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <head>
        {/* Mobile browser chrome colour */}
        <meta name="theme-color" content="#0d0e15" />
        {/* Structured data for Google rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
