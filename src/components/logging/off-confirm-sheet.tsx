"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useConfirmOffFood } from "@/lib/providers/off-mutations";
import type { FoodCandidate, NutrientKey } from "@/lib/providers/types";
import { getErrorMessage } from "@/lib/error";

interface OffConfirmSheetProps {
  candidate: FoodCandidate;
  onConfirmed: (confirmed: FoodCandidate) => void;
  onCancel: () => void;
}

// nutrition-tracker-schema.md §3.3's macros-only OFF contract, in display
// order. Anything not in candidate.nutrients is genuinely missing — never
// rendered as 0 (CLAUDE.md invariant #5).
const DISPLAY_FIELDS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: "energy", label: "Energy", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carb", label: "Carbohydrate", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugarFree", label: "Sugars", unit: "g" },
  { key: "fatSat", label: "Saturated fat", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

export function OffConfirmSheet({
  candidate,
  onConfirmed,
  onCancel,
}: OffConfirmSheetProps) {
  const confirmOffFood = useConfirmOffFood();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      const confirmed = await confirmOffFood.mutateAsync(candidate);
      onConfirmed(confirmed);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

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
        <h2 className="mb-1 text-lg font-extrabold">{candidate.name}</h2>
        <p className="mb-4 text-xs text-stone-500">
          via Open Food Facts &middot; label data &middot; not yet in your
          catalog
        </p>

        <dl className="mb-4 grid grid-cols-2 gap-y-2 rounded-2xl bg-stone-50 p-3.5 text-sm">
          {DISPLAY_FIELDS.map(({ key, label, unit }) => {
            const amount = candidate.nutrients[key];
            return (
              <div key={key} className="flex items-baseline justify-between pr-2">
                <dt className="text-stone-600">{label}</dt>
                <dd className={amount === undefined ? "text-stone-400" : "font-semibold"}>
                  {amount === undefined ? "not reported" : `${amount} ${unit}`}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="mb-6 text-xs text-stone-400">
          Nutrition data &copy; Open Food Facts contributors, ODbL. Adding
          this saves it to your catalog so you can find it by name next time.
        </p>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-2xl shadow-glow"
            onClick={handleConfirm}
            disabled={confirmOffFood.isPending}
          >
            {confirmOffFood.isPending ? "Adding…" : "Add to Eat List"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
