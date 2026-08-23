"use client";

import { useState } from "react";
import { Info } from "lucide-react";

// Tap-to-toggle, not hover — this is a mobile-first PWA and hover doesn't
// exist on touch.
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More info"
        className="text-stone-400 hover:text-stone-600"
      >
        <Info size={14} />
      </button>
      {open ? (
        <>
          {/* click-outside catcher */}
          <span
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <span className="absolute left-0 top-5 z-50 w-56 rounded-md border border-stone-200 bg-white p-2 text-xs font-normal normal-case text-stone-600 shadow-md">
            {text}
          </span>
        </>
      ) : null}
    </span>
  );
}
