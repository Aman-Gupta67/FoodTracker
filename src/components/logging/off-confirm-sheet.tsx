"use client";

import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[480px] rounded-t-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-medium">{candidate.name}</h2>
        <p className="mb-4 text-xs text-stone-500">
          via Open Food Facts &middot; label data &middot; not yet in your
          catalog
        </p>

        <dl className="mb-4 grid grid-cols-2 gap-y-2 rounded-md bg-stone-100 p-3 text-sm">
          {DISPLAY_FIELDS.map(({ key, label, unit }) => {
            const amount = candidate.nutrients[key];
            return (
              <div key={key} className="flex items-baseline justify-between pr-2">
                <dt className="text-stone-600">{label}</dt>
                <dd className={amount === undefined ? "text-stone-400" : "font-medium"}>
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
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirmOffFood.isPending}
          >
            {confirmOffFood.isPending ? "Adding…" : "Add to Eat List"}
          </Button>
        </div>
      </div>
    </div>
  );
}
