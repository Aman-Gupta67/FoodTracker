"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateDishLogEntry } from "@/lib/log/hooks";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/lib/log/types";
import { getNowIso, getTodayDateString } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import type { Dish } from "@/lib/meals/types";

export function LogDishSheet({
  dish,
  initialMeal,
  date: dateProp,
  onClose,
  onLogged,
}: {
  dish: Dish;
  initialMeal?: MealSlot;
  // Defaults to today for the Meals list (no date context there); Add
  // passes the day actually being logged for, so a dish logged while
  // viewing a past date lands on that date, not today.
  date?: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const date = dateProp ?? getTodayDateString();
  const [meal, setMeal] = useState<MealSlot>(initialMeal ?? "breakfast");
  const [servings, setServings] = useState<number | "">("");
  const numericServings = servings === "" ? 0 : servings;
  const [error, setError] = useState<string | null>(null);
  const createDishLog = useCreateDishLogEntry(date);

  function stepServings(sign: 1 | -1) {
    setServings((prev) => {
      const current = prev === "" ? 0 : prev;
      return Math.max(0, Math.round((current + sign * 0.5) * 100) / 100);
    });
  }

  async function handleLog() {
    setError(null);
    try {
      await createDishLog.mutateAsync({
        consumedAt: getNowIso(),
        consumedDate: date,
        meal,
        dishId: dish.id,
        quantity: numericServings,
      });
      onLogged();
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
        <h2 className="mb-4 text-lg font-extrabold">{dish.name}</h2>

        <div className="mb-4 flex flex-wrap gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setMeal(slot)}
              className={
                "rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors " +
                (meal === slot
                  ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
                  : "border-[1.5px] border-stone-200 text-stone-600")
              }
            >
              {MEAL_SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-center gap-5 rounded-[18px] bg-stone-50 p-3.5">
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => stepServings(-1)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-white text-stone-700 shadow-sm active:scale-90"
          >
            <Minus size={18} />
          </button>
          <div className="text-center">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="0"
              value={servings}
              onChange={(e) =>
                setServings(e.target.value === "" ? "" : Number(e.target.value) || 0)
              }
              className="w-20 border-none bg-transparent text-center text-[30px] font-extrabold tracking-tight text-stone-900 outline-none"
            />
            <p className="text-[11.5px] font-semibold text-stone-500">servings</p>
          </div>
          <button
            type="button"
            aria-label="Increase"
            onClick={() => stepServings(1)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow active:scale-90"
          >
            <Plus size={18} />
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-2xl shadow-glow"
            onClick={handleLog}
            disabled={createDishLog.isPending || numericServings <= 0}
          >
            {createDishLog.isPending ? "Logging…" : "Log"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
