"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Camera, X, CheckCircle, Loader2 } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => Promise<boolean>;
  onClose: () => void;
}

export default function Scanner({ onScan, onClose }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const onScanRef = useRef(onScan);
  const lastBarcodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const [status, setStatus] = useState<"idle" | "scanning" | "found" | "notfound">("idle");

  // Keep callback refs fresh without triggering re-render/re-init
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleDecode = useCallback(async (decodedText: string) => {
    const now = Date.now();
    // Dedupe: same barcode within 2s OR any scan within 300ms
    if (
      (decodedText === lastBarcodeRef.current && now - lastScanTimeRef.current < 2000) ||
      now - lastScanTimeRef.current < 300
    ) return;

    lastBarcodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    setStatus("scanning");
    const success = await onScanRef.current(decodedText);
    setStatus(success ? "found" : "notfound");

    // Auto-close after brief success flash
    setTimeout(() => onCloseRef.current(), 600);
  }, []);

  useEffect(() => {
    const element = document.getElementById("reader");
    if (!element || scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.333,
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false
    );

    scanner.render(handleDecode, () => {});
    scannerRef.current = scanner;

    return () => {
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [handleDecode]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#0c1324] shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-4 bg-white/5">
          <div className="flex items-center gap-2">
            <Camera className="text-white" size={20} />
            <h2 className="font-bold text-white tracking-widest text-sm uppercase">Scan Barcode</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner view */}
        <div className="relative bg-black aspect-[4/3] sm:aspect-[16/9] overflow-hidden flex items-center justify-center">
          <div id="reader" className="absolute inset-0 w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover opacity-80" />

          {/* Camera Frame Overlay */}
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
             {/* The dark overlay outside constraints - achievable via box-shadow */}
             <div className="relative w-64 h-40 sm:w-80 sm:h-48 rounded-xl border-2 border-white/20 shadow-[0_0_0_4000px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />

                {/* Animated scan line */}
                {status === "idle" && (
                   <div className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_12px_2px_rgba(74,222,128,0.7)] scanner-line" />
                )}
             </div>
             <p className="mt-8 text-center text-sm font-bold tracking-wide text-white drop-shadow-md bg-black/40 px-5 py-2 rounded-full backdrop-blur-md">
               Align barcode inside frame
             </p>
          </div>

          {/* Instant feedback overlay */}
          {status === "scanning" && (
            <div className="absolute z-20 inset-4 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 size={40} className="animate-spin text-white" />
                <span className="font-semibold text-sm tracking-wide">LOOKING UP...</span>
              </div>
            </div>
          )}
          {status === "found" && (
            <div className="absolute z-20 inset-4 flex items-center justify-center rounded-2xl bg-green-500/20 backdrop-blur-md border border-green-400/30">
              <div className="flex flex-col items-center gap-3 text-green-100">
                <CheckCircle size={48} className="text-green-400 drop-shadow-lg" />
                <span className="font-bold tracking-widest text-sm">ADDED TO CART</span>
              </div>
            </div>
          )}
          {status === "notfound" && (
             <div className="absolute z-20 inset-4 flex items-center justify-center rounded-2xl bg-blue-500/20 backdrop-blur-md border border-blue-400/30">
               <div className="flex flex-col items-center gap-3 text-blue-100">
                 <Loader2 size={48} className="text-blue-400 drop-shadow-lg animate-spin" />
                 <span className="font-bold tracking-widest text-sm text-center">PRODUCT NOT FOUND<br/>OPENING CREATOR...</span>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
