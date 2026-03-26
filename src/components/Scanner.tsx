"use client";

import { useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => Promise<boolean>;
  onClose: () => void;
}

export default function Scanner({ onScan, onClose }: ScannerProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Keep callbacks fresh without triggering effect re-runs
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const lastBarcodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  // Prevent double initialization in React Strict Mode
  const isStartingRef = useRef(false);

  const handleDecode = useCallback(async (decodedText: string) => {
    const now = Date.now();
    // Debounce scans
    if (decodedText === lastBarcodeRef.current && now - lastScanTimeRef.current < 2000) return;

    lastBarcodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    // Only close if the onScan callback returns true (success)
    const success = await onScanRef.current(decodedText);
    if (success) {
      onCloseRef.current();
    }
  }, []);

  useEffect(() => {
    const element = document.getElementById("reader");
    if (!element || isStartingRef.current) return;

    let isMounted = true;
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCodeRef.current = html5QrCode;

    const startScanner = async () => {
      isStartingRef.current = true;
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10, // Lowered to 10 to save battery/reduce device heat
            qrbox: { width: 280, height: 180 },
            aspectRatio: window.innerWidth / window.innerHeight,
          },
          handleDecode,
          () => { } // error callback (silent)
        );

        // Critical: If the component unmounted while the camera was initializing, stop it now
        if (!isMounted && html5QrCode.isScanning) {
          await html5QrCode.stop();
          html5QrCode.clear();
        }
      } catch (err) {
        console.error("Scanner start error:", err);
      } finally {
        isStartingRef.current = false;
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      // Standard cleanup for when the component unmounts after successful startup
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(err => console.error("Scanner stop error:", err));
      }
    };
  }, [handleDecode]);

  return (
    <div className="fixed inset-0 z-[150] bg-black">
      {/* CRITICAL: Html5Qrcode (without UI) expects an element to render into.
          We make this element 100% screen size. 
      */}
      <div id="reader" className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

      {/* FIXED TOP CLOSE BUTTON */}
      <div className="absolute top-0 right-0 z-[170] p-6">
        <button
          onClick={onClose}
          className="rounded-full bg-black/40 backdrop-blur-md p-3 text-white border border-white/20 hover:bg-black/60 transition-all active:scale-90"
        >
          <X size={28} />
        </button>
      </div>

      {/* OVERLAY - On top of camera */}
      <div className="absolute inset-0 z-[160] flex flex-col items-center justify-center pointer-events-none p-8">
        <div className="relative w-full max-w-[300px] aspect-[4/3] rounded-[40px] border-2 border-white/50 shadow-[0_0_0_4000px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-700">
          {/* Scan Line Animation */}
          <div className="absolute left-0 right-0 h-[2px] bg-white/40 shadow-[0_0_15px_rgba(255,255,255,0.8)] scanner-line" />
        </div>

        <div className="mt-10">
          <p className="text-white text-lg font-black tracking-tight drop-shadow-2xl">Align barcode inside frame</p>
        </div>
      </div>
    </div>
  );
}