"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveFoodCandidates } from "@/lib/providers/resolve";
import type { FoodCandidate } from "@/lib/providers/types";

interface BarcodeScannerSheetProps {
  onResolved: (candidate: FoodCandidate) => void;
  onNotFound: (barcode: string) => void;
  onClose: () => void;
}

type Status = "scanning" | "looking-up" | "camera-error";

// @zxing/browser (JS/WASM decode) instead of the native BarcodeDetector API
// — Safari/iOS doesn't implement BarcodeDetector, and this app needs to
// behave the same on iOS and Android rather than silently failing on one.
export function BarcodeScannerSheet({
  onResolved,
  onNotFound,
  onClose,
}: BarcodeScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lookingUpRef = useRef(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [status, setStatus] = useState<Status>("scanning");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, ctrl) => {
        controls = ctrl;
        if (cancelled || lookingUpRef.current || !result) return;
        void handleBarcode(result.getText());
      })
      .catch(() => {
        if (!cancelled) setStatus("camera-error");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBarcode(barcode: string) {
    lookingUpRef.current = true;
    setStatus("looking-up");
    const controller = new AbortController();
    try {
      const results = await resolveFoodCandidates({ text: barcode }, controller.signal);
      if (results.length > 0) {
        onResolved(results[0]!);
      } else {
        onNotFound(barcode);
      }
    } finally {
      lookingUpRef.current = false;
      setStatus("scanning");
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualBarcode.trim();
    if (trimmed) void handleBarcode(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-sm font-medium">Scan a barcode</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="text-white/80 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        {status === "looking-up" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            Looking up…
          </div>
        ) : null}
        {status === "camera-error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white">
            Couldn&apos;t access the camera. Enter the barcode number below
            instead.
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleManualSubmit}
        className="flex gap-2 border-t border-stone-800 bg-white p-4"
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter barcode manually"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          className="h-10 flex-1 field-input"
        />
        <Button type="submit" disabled={status === "looking-up"}>
          Look up
        </Button>
      </form>
    </div>
  );
}
