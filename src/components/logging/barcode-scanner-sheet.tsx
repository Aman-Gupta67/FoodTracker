"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
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

// Retail packaging barcodes are 1D — restricting formats (instead of the
// default all-formats search, which also checks 2D/QR) cuts the per-frame
// decode search space and measurably speeds up a hit.
const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const DECODE_INTERVAL_MS = 200;
// Digitally re-magnifies the cropped scan-box region before handing it to
// the decoder — the same fix as "hold it closer," applied without relying
// on the camera's own (often weak, on a laptop) autofocus/macro range.
const CROP_UPSCALE = 2;

// Maps the on-screen scan box to the video's actual pixel coordinates,
// accounting for object-fit: cover cropping the intrinsic frame to fill
// the container, then returns a canvas of just that region, upscaled.
function captureBoxRegion(
  video: HTMLVideoElement,
  box: HTMLElement,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoRect = video.getBoundingClientRect();
  if (!vw || !vh || videoRect.width === 0 || videoRect.height === 0) return null;

  const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
  const renderedW = vw * scale;
  const renderedH = vh * scale;
  const offsetX = (renderedW - videoRect.width) / 2;
  const offsetY = (renderedH - videoRect.height) / 2;

  const boxRect = box.getBoundingClientRect();
  const srcX = Math.max(0, (boxRect.left - videoRect.left + offsetX) / scale);
  const srcY = Math.max(0, (boxRect.top - videoRect.top + offsetY) / scale);
  const srcW = Math.min(boxRect.width / scale, vw - srcX);
  const srcH = Math.min(boxRect.height / scale, vh - srcY);
  if (srcW <= 0 || srcH <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = srcW * CROP_UPSCALE;
  canvas.height = srcH * CROP_UPSCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// @zxing/browser (JS/WASM decode) instead of the native BarcodeDetector API
// — Safari/iOS doesn't implement BarcodeDetector, and this app needs to
// behave the same on iOS and Android rather than silently failing on one.
export function BarcodeScannerSheet({
  onResolved,
  onNotFound,
  onClose,
}: BarcodeScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lookingUpRef = useRef(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [status, setStatus] = useState<Status>("scanning");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(HINTS);
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // focusMode is a non-standard (Chrome/Android-only) constraint,
            // not in the TS DOM lib — harmless no-op where unsupported.
            advanced: [{ focusMode: "continuous" }] as unknown as MediaTrackConstraintSet[],
          },
        });
      } catch {
        if (!cancelled) setStatus("camera-error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      tick();
    }

    function tick() {
      if (cancelled) return;
      if (!lookingUpRef.current) {
        const video = videoRef.current;
        const box = boxRef.current;
        if (video && box && video.readyState >= 2) {
          const canvas = captureBoxRegion(video, box);
          if (canvas) {
            try {
              const result = reader.decodeFromCanvas(canvas);
              void handleBarcode(result.getText());
            } catch {
              // No barcode in this frame — expected on most ticks.
            }
          }
        }
      }
      timer = setTimeout(tick, DECODE_INTERVAL_MS);
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
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

        {/* Scan-region guide: box-shadow dims everything outside the box in
            one element, corner brackets mimic the "align here" convention
            common to barcode-scanner apps. */}
        <div
          ref={boxRef}
          className="absolute left-1/2 top-1/2 aspect-[5/2] w-[78%] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-lg"
          style={{ boxShadow: "0 0 0 100vmax rgba(0, 0, 0, 0.55)" }}
        >
          <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-green-400" />
          <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-green-400" />
          <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-green-400" />
          <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-green-400" />
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/90">
          Align the barcode within the frame
        </p>

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
        className="flex gap-2 rounded-t-[24px] bg-white p-4"
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter barcode manually"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          className="h-11 flex-1 rounded-2xl field-input"
        />
        <Button className="rounded-2xl shadow-glow" type="submit" disabled={status === "looking-up"}>
          Look up
        </Button>
      </form>
    </div>
  );
}
