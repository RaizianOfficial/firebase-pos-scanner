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
    // dedupe scans within 2 seconds
    if (decodedText === lastBarcodeRef.current && now - lastScanTimeRef.current < 2000) return;

    lastBarcodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    setStatus("scanning");
    const success = await onScanRef.current(decodedText);
    setStatus(success ? "found" : "idle");

    // Close instantly as requested
    onCloseRef.current();
  }, []);

  useEffect(() => {
    const element = document.getElementById("reader");
    if (!element || scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 20, // Increase FPS for faster detection
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0, 
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
    <div className="fixed inset-0 z-[150] flex flex-col bg-black">
      {/* Minimal Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[160] flex items-center justify-between p-6">
        <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-all active:scale-90"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        <div id="reader" className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

        {/* Minimal Scan Frame */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8">
           <div className="relative w-full max-w-[280px] aspect-[4/3] rounded-3xl border-2 border-white/40 shadow-[0_0_0_4000px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Optional Scanning Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-white/20 scanner-line" />
           </div>

           <div className="mt-8">
              <p className="text-white/80 font-bold text-sm tracking-wide">Align barcode inside frame</p>
           </div>
        </div>
      </div>
    </div>
  );
}
