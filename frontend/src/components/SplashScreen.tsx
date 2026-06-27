"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  // Fallback in case video fails to load/play or is missing
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        >
          {/* 
            Responsive 1:1 square wrapper that never exceeds screen width or height.
            It uses min(100vw, 100dvh) to always fit and stay perfectly centered.
          */}
          <div className="relative w-full max-w-[min(100vw,100dvh)] aspect-square overflow-hidden flex items-center justify-center">
            <video
              src="/splashscreen.mp4"
              autoPlay
              muted
              playsInline
              onEnded={() => setShow(false)}
              /* Make the video 2% larger than the square wrapper to crop out the border artifacts */
              className="w-[102%] h-[102%] max-w-none object-cover"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
