"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { resolveYield } from "@/lib/catalog/yield";
import { getFoodPortionsWithId } from "@/lib/catalog/food-detail";
import { useCreateLogEntry, useLastLogForFood } from "@/lib/log/hooks";
import type { MealSlot } from "@/lib/log/types";
import type { FoodCandidate } from "@/lib/providers/types";
import { getNowIso } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";

interface QuantitySheetProps {
  food: FoodCandidate;
  meal: MealSlot;
  date: string;
  onClose: () => void;
  onLogged: () => void;
}

export function QuantitySheet({
  food,
  meal,
  date,
  onClose,
  onLogged,
}: QuantitySheetProps) {
  const foodId = food.id ? Number(food.id) : null;

  const { data: portions = [] } = useQuery({
    queryKey: ["food-portions", foodId],
    queryFn: () => getFoodPortionsWithId(foodId!),
    enabled: foodId !== null,
  });
  const { data: yieldFactor } = useQuery({
    queryKey: ["yield", foodId],
    queryFn: () => resolveYield(foodId!),
    enabled: foodId !== null,
  });
  const { data: lastLog } = useLastLogForFood(foodId);
  const createLogEntry = useCreateLogEntry(date);

  const [selectedPortionId, setSelectedPortionId] = useState<number | null>(
    null,
  );
  const [initializedPortion, setInitializedPortion] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [enteredState, setEnteredState] = useState<"raw" | "cooked">("raw");
  const [error, setError] = useState<string | null>(null);

  // Default to the first portion once portions load, unless a prior log
  // (below) sets a more specific one.
  useEffect(() => {
    if (!initializedPortion && portions.length > 0) {
      setSelectedPortionId(portions[0]!.id);
      setInitializedPortion(true);
    }
  }, [portions, initializedPortion]);

  // Pre-fill from the last time this food was logged — mvp-build-plan.md
  // §6.3: "most of the difference between 10 seconds and 40."
  useEffect(() => {
    if (!lastLog) return;
    setQuantity(lastLog.quantity);
    setEnteredState(lastLog.enteredState);
    setSelectedPortionId(lastLog.portionId);
    setInitializedPortion(true);
  }, [lastLog]);

  const selectedPortion =
    selectedPortionId !== null
      ? (portions.find((p) => p.id === selectedPortionId) ?? null)
      : null;
  const enteredGrams = selectedPortion
    ? selectedPortion.grams * quantity
    : quantity;

  const showCookedToggle = (yieldFactor ?? 1) !== 1;
  const rawEquivalentGrams =
    enteredState === "cooked" && yieldFactor
      ? enteredGrams / yieldFactor
      : enteredGrams;

  const preview = useMemo(() => {
    const factor = rawEquivalentGrams / 100;
    return {
      calories: (food.nutrients.energy ?? 0) * factor,
      protein: (food.nutrients.protein ?? 0) * factor,
      carb: (food.nutrients.carb ?? 0) * factor,
      fat: (food.nutrients.fat ?? 0) * factor,
    };
  }, [food.nutrients, rawEquivalentGrams]);

  async function handleLog() {
    if (foodId === null) return;
    setError(null);
    try {
      await createLogEntry.mutateAsync({
        consumedAt: getNowIso(),
        consumedDate: date,
        meal,
        foodId,
        portionId: selectedPortionId,
        quantity,
        enteredState,
        enteredGrams,
      });
      onLogged();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[480px] rounded-t-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-medium">{food.name}</h2>
        <p className="mb-4 text-xs text-stone-500">
          {food.provenance.source} · {food.provenance.confidence}
        </p>

        {portions.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {portions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPortionId(p.id)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm " +
                  (selectedPortionId === p.id
                    ? "border-primary-500 bg-primary-100 text-primary-700"
                    : "border-stone-300 text-stone-700")
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedPortionId(null)}
              className={
                "rounded-full border px-3 py-1.5 text-sm " +
                (selectedPortionId === null
                  ? "border-primary-500 bg-primary-100 text-primary-700"
                  : "border-stone-300 text-stone-700")
              }
            >
              grams
            </button>
          </div>
        ) : null}

        <div className="mb-4 flex items-center gap-3">
          <input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
            className="h-10 w-24 field-input"
          />
          <span className="text-sm text-stone-600">
            {selectedPortion ? `× ${selectedPortion.label}` : "grams"}
          </span>
        </div>

        {showCookedToggle ? (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setEnteredState("raw")}
              className={
                "rounded-md border px-3 py-1.5 " +
                (enteredState === "raw"
                  ? "border-primary-500 bg-primary-100 text-primary-700"
                  : "border-stone-300 text-stone-700")
              }
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setEnteredState("cooked")}
              className={
                "rounded-md border px-3 py-1.5 " +
                (enteredState === "cooked"
                  ? "border-primary-500 bg-primary-100 text-primary-700"
                  : "border-stone-300 text-stone-700")
              }
            >
              Cooked
            </button>
            {enteredState === "cooked" ? (
              <span className="text-xs text-stone-500">
                ≈ {rawEquivalentGrams.toFixed(1)} g raw (estimated)
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-4 gap-2 rounded-md bg-stone-100 p-3 text-center text-xs">
          <div>
            <div className="font-medium text-primary-700">
              {preview.calories.toFixed(0)}
            </div>
            <div className="text-stone-500">kcal</div>
          </div>
          <div>
            <div className="font-medium" style={{ color: "var(--color-protein)" }}>
              {preview.protein.toFixed(1)}
            </div>
            <div className="text-stone-500">protein</div>
          </div>
          <div>
            <div className="font-medium" style={{ color: "var(--color-carbs)" }}>
              {preview.carb.toFixed(1)}
            </div>
            <div className="text-stone-500">carb</div>
          </div>
          <div>
            <div className="font-medium" style={{ color: "var(--color-fat)" }}>
              {preview.fat.toFixed(1)}
            </div>
            <div className="text-stone-500">fat</div>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleLog}
            disabled={createLogEntry.isPending || enteredGrams <= 0}
          >
            {createLogEntry.isPending ? "Logging…" : "Log"}
          </Button>
        </div>
      </div>
    </div>
  );
}
