"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveYield } from "@/lib/catalog/yield";
import { getFoodPortionsWithId } from "@/lib/catalog/food-detail";
import { useCreateLogEntry, useLastLogForFood } from "@/lib/log/hooks";
import type { MealSlot } from "@/lib/log/types";
import type { FoodCandidate } from "@/lib/providers/types";
import { getNowIso } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import { useConfirmLlmFood } from "@/lib/ai/confirm-llm-food";

interface QuantitySheetProps {
  food: FoodCandidate;
  meal: MealSlot;
  date: string;
  // Natural-language logging already knows an estimated gram amount —
  // pre-filling it is the same "don't retype what's already known"
  // principle as pre-filling from the last log.
  initialGrams?: number;
  onClose: () => void;
  onLogged: () => void;
}

export function QuantitySheet({
  food,
  meal,
  date,
  initialGrams,
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
  const confirmLlmFood = useConfirmLlmFood();

  const [selectedPortionId, setSelectedPortionId] = useState<number | null>(
    null,
  );
  const [initializedPortion, setInitializedPortion] = useState(false);
  // Blank rather than defaulting to 1: a first-time food has no sensible
  // default grams, and typing over a stale "1" is worse than typing into an
  // empty field. AI items still prefill (initialGrams), and repeat manual
  // foods still prefill from lastLog below — this only affects the
  // no-history, no-AI-estimate case.
  const [quantity, setQuantity] = useState<number | "">(initialGrams ?? "");
  const numericQuantity = quantity === "" ? 0 : quantity;
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
  // §6.3: "most of the difference between 10 seconds and 40." Skipped when
  // initialGrams was explicitly provided (an AI-parsed/suggested item):
  // that estimate is already the more relevant default for THIS meal, and
  // must win over a possibly-unrelated older log of the same food.
  useEffect(() => {
    if (!lastLog || initialGrams !== undefined) return;
    setQuantity(lastLog.quantity);
    setEnteredState(lastLog.enteredState);
    setSelectedPortionId(lastLog.portionId);
    setInitializedPortion(true);
  }, [lastLog, initialGrams]);

  const selectedPortion =
    selectedPortionId !== null
      ? (portions.find((p) => p.id === selectedPortionId) ?? null)
      : null;
  const enteredGrams = selectedPortion
    ? selectedPortion.grams * numericQuantity
    : numericQuantity;

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

  function stepQuantity(sign: 1 | -1) {
    const step = selectedPortion ? 0.5 : 10;
    setQuantity((prev) => {
      const current = prev === "" ? 0 : prev;
      const next = Math.max(0, Math.round((current + sign * step) * 100) / 100);
      return next;
    });
  }

  async function handleLog() {
    setError(null);
    try {
      let resolvedFoodId = foodId;
      if (resolvedFoodId === null) {
        if (!food.needsConfirmation) {
          throw new Error("This food isn't in the catalog yet.");
        }
        // First time this exact AI-sourced food is logged: write it into
        // the catalog (review-sheet-before-write, per CLAUDE.md's
        // provenance rule) so it's a real, searchable food from now on —
        // the LLM only ever has to be asked once per genuinely new food.
        resolvedFoodId = await confirmLlmFood.mutateAsync(food);
      }

      await createLogEntry.mutateAsync({
        consumedAt: getNowIso(),
        consumedDate: date,
        meal,
        foodId: resolvedFoodId,
        portionId: selectedPortionId,
        quantity: numericQuantity,
        enteredState,
        enteredGrams,
      });
      onLogged();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  const isSubmitting = createLogEntry.isPending || confirmLlmFood.isPending;

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
        <h2 className="mb-4 text-lg font-extrabold">{food.name}</h2>

        {portions.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {portions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPortionId(p.id)}
                className={
                  "rounded-full px-4 py-2 text-[13px] font-bold transition-colors " +
                  (selectedPortionId === p.id
                    ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
                    : "border-[1.5px] border-stone-200 text-stone-600")
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedPortionId(null)}
              className={
                "rounded-full px-4 py-2 text-[13px] font-bold transition-colors " +
                (selectedPortionId === null
                  ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
                  : "border-[1.5px] border-stone-200 text-stone-600")
              }
            >
              grams
            </button>
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-center gap-5 rounded-[18px] bg-stone-50 p-3.5">
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => stepQuantity(-1)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-white text-stone-700 shadow-sm active:scale-90"
          >
            <Minus size={18} />
          </button>
          <div className="text-center">
            <input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value === "" ? "" : Number(e.target.value) || 0)
              }
              className="w-24 border-none bg-transparent text-center text-[30px] font-extrabold tracking-tight text-stone-900 outline-none"
            />
            <p className="text-[11.5px] font-semibold text-stone-500">
              {selectedPortion ? `× ${selectedPortion.label} (${selectedPortion.grams}g)` : "grams"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Increase"
            onClick={() => stepQuantity(1)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow active:scale-90"
          >
            <Plus size={18} />
          </button>
        </div>

        {showCookedToggle ? (
          <div className="mb-4">
            <div className="flex rounded-full bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setEnteredState("raw")}
                className={
                  "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors " +
                  (enteredState === "raw" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")
                }
              >
                Raw
              </button>
              <button
                type="button"
                onClick={() => setEnteredState("cooked")}
                className={
                  "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors " +
                  (enteredState === "cooked" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")
                }
              >
                Cooked
              </button>
            </div>
            {enteredState === "cooked" ? (
              <p className="mt-1.5 text-xs text-stone-500">
                ≈ {rawEquivalentGrams.toFixed(1)} g raw (estimated)
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-primary-50 py-2.5">
            <div className="text-base font-extrabold text-primary-700">
              {preview.calories.toFixed(0)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">kcal</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-protein-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-protein)" }}>
              {preview.protein.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">protein</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-carbs-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-carbs)" }}>
              {preview.carb.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">carb</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-fat-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-fat)" }}>
              {preview.fat.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">fat</div>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-2xl shadow-glow"
            onClick={handleLog}
            disabled={isSubmitting || enteredGrams <= 0}
          >
            {confirmLlmFood.isPending
              ? "Adding to catalog…"
              : createLogEntry.isPending
                ? "Logging…"
                : "Log"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
