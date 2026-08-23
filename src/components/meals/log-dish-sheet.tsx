"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateDishLogEntry } from "@/lib/log/hooks";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/lib/log/types";
import { getNowIso, getTodayDateString } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import type { Dish } from "@/lib/meals/types";

export function LogDishSheet({
  dish,
  initialMeal,
  onClose,
  onLogged,
}: {
  dish: Dish;
  initialMeal?: MealSlot;
  onClose: () => void;
  onLogged: () => void;
}) {
  const date = getTodayDateString();
  const [meal, setMeal] = useState<MealSlot>(initialMeal ?? "breakfast");
  const [servings, setServings] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const createDishLog = useCreateDishLogEntry(date);

  async function handleLog() {
    setError(null);
    try {
      await createDishLog.mutateAsync({
        consumedAt: getNowIso(),
        consumedDate: date,
        meal,
        dishId: dish.id,
        quantity: servings,
      });
      onLogged();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[480px] rounded-t-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-medium">{dish.name}</h2>

        <div className="mb-4 flex flex-wrap gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setMeal(slot)}
              className={
                "rounded-full border px-3 py-1.5 text-sm " +
                (meal === slot
                  ? "border-primary-500 bg-primary-100 text-primary-700"
                  : "border-stone-300 text-stone-700")
              }
            >
              {MEAL_SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        <div className="mb-6 flex items-center gap-3">
          <input
            type="number"
            min={0}
            step="any"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 0)}
            className="h-10 w-24 field-input"
          />
          <span className="text-sm text-stone-600">servings</span>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleLog}
            disabled={createDishLog.isPending || servings <= 0}
          >
            {createDishLog.isPending ? "Logging…" : "Log"}
          </Button>
        </div>
      </div>
    </div>
  );
}
