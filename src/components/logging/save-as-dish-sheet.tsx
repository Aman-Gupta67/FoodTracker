"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface SaveAsDishSheetProps {
  suggestedName: string;
  isSaving: boolean;
  error: string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}

// Naming step for turning a resolved multi-item AI meal into a my_dish —
// the parent owns the actual save (resolving each item to a foodId, then
// createDish), this is purely the name prompt.
export function SaveAsDishSheet({
  suggestedName,
  isSaving,
  error,
  onSave,
  onCancel,
}: SaveAsDishSheetProps) {
  const [name, setName] = useState(suggestedName);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-[480px] rounded-t-[28px] bg-white p-5 pb-6 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        <h2 className="mb-4 text-lg font-extrabold">Add to Eat List</h2>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 h-11 w-full rounded-2xl field-input"
          autoFocus
        />
        <p className="mb-4 text-xs text-stone-500">
          Saves this combination so next time you can find it by searching,
          instead of describing it to AI again.
        </p>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-2xl shadow-glow"
            onClick={() => onSave(name)}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
