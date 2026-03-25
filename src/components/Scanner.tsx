"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Camera, X, CheckCircle, Loader2 } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => Promise<void>;
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
    await onScanRef.current(decodedText);
    setStatus("found");

    // Auto-close after brief success flash
    setTimeout(() => onCloseRef.current(), 600);
  }, []); // Empty dependencies! Extremely important!

  useEffect(() => {
    const element = document.getElementById("reader");
    if (!element || scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10, // Lowered from 15 to 10 for better battery/CPU while maintaining speed
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
  }, [handleDecode]); // handleDecode is now perfectly stable

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <Camera className="text-black" size={20} />
            <h2 className="font-semibold text-slate-800">Scan Barcode</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner view */}
        <div className="p-4 relative">
          <div id="reader" className="w-full overflow-hidden rounded-lg bg-slate-100" />

          {/* Instant feedback overlay */}
          {status === "scanning" && (
            <div className="absolute inset-4 flex items-center justify-center rounded-lg bg-neutral-1000/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-neutral-800">
                <Loader2 size={36} className="animate-spin" />
                <span className="font-semibold text-sm">Looking up product…</span>
              </div>
            </div>
          )}
          {status === "found" && (
            <div className="absolute inset-4 flex items-center justify-center rounded-lg bg-green-500/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-green-700">
                <CheckCircle size={40} />
                <span className="font-bold text-sm">Added to cart!</span>
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Align barcode within the frame — scanning automatically
          </p>
        </div>
      </div>
    </div>
  );
}
