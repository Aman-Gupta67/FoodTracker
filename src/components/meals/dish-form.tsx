"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoodTile } from "@/components/ui/food-tile";
import { resolveFoodCandidates } from "@/lib/providers/resolve";
import type { FoodCandidate } from "@/lib/providers/types";
import { useIngredientMacros } from "@/lib/meals/hooks";
import type { NewDishIngredient } from "@/lib/meals/queries";
import { resolveParsedItems, type ParsedMealItem } from "@/lib/ai/resolve-parsed-items";
import { fetchJsonWithRetry } from "@/lib/ai/fetch-json";
import { useConfirmLlmFood } from "@/lib/ai/confirm-llm-food";
import { getErrorMessage } from "@/lib/error";

export interface EditableIngredient {
  foodId: number;
  foodName: string;
  grams: number;
}

export interface DishFormValue {
  name: string;
  servings: number;
  ingredients: EditableIngredient[];
}

export function DishForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
}: {
  initial: DishFormValue;
  submitLabel: string;
  onSubmit: (value: DishFormValue) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [servings, setServings] = useState(initial.servings);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>(
    initial.ingredients,
  );
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<FoodCandidate[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const confirmLlmFood = useConfirmLlmFood();

  // Disable Save/Create until the form actually differs from what it loaded
  // with — there's nothing to persist otherwise.
  const isDirty = useMemo(() => {
    return (
      name !== initial.name ||
      servings !== initial.servings ||
      JSON.stringify(ingredients) !== JSON.stringify(initial.ingredients)
    );
  }, [name, servings, ingredients, initial]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(() => {
      resolveFoodCandidates({ text: query }, controller.signal).then((r) => {
        if (!controller.signal.aborted) setSearchResults(r);
      });
    }, 150);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const macroIngredients: NewDishIngredient[] = ingredients.map((i) => ({
    foodId: i.foodId,
    grams: i.grams,
  }));
  const { data: totalMacros } = useIngredientMacros(macroIngredients);
  const perServing = totalMacros
    ? {
        calories: totalMacros.calories / (servings || 1),
        protein: totalMacros.protein / (servings || 1),
        carb: totalMacros.carb / (servings || 1),
        fat: totalMacros.fat / (servings || 1),
      }
    : null;

  function addIngredient(food: FoodCandidate) {
    if (!food.id) return;
    setIngredients((prev) => [
      ...prev,
      { foodId: Number(food.id), foodName: food.name, grams: 100 },
    ]);
    setQuery("");
    setSearchResults([]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  // Catalog + OFF search comes up empty for plenty of home-cooked dishes —
  // this reuses the same AI meal-parsing endpoint as a single-food lookup so
  // an ingredient the catalog doesn't have isn't a dead end.
  async function handleAiSearch() {
    if (!query.trim()) return;
    setIsAiSearching(true);
    setAiError(null);
    try {
      const { res, body } = await fetchJsonWithRetry("/api/ai/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
      });
      if (!res.ok) {
        throw new Error((body as { error?: string })?.error ?? "Could not search with AI.");
      }
      const resolved = await resolveParsedItems((body as { items: ParsedMealItem[] }).items);
      setAiResults(resolved.map((r) => r.candidate));
    } catch (e) {
      setAiError(getErrorMessage(e));
    } finally {
      setIsAiSearching(false);
    }
  }

  // An AI-sourced candidate has no food.id yet — write it into the catalog
  // once (review-sheet-before-write, same rule as everywhere else) before
  // it can be referenced as a foodId ingredient.
  async function addAiIngredient(candidate: FoodCandidate) {
    setAiError(null);
    try {
      const foodId = candidate.id
        ? Number(candidate.id)
        : await confirmLlmFood.mutateAsync(candidate);
      setIngredients((prev) => [
        ...prev,
        { foodId, foodName: candidate.name, grams: 100 },
      ]);
      setQuery("");
      setAiResults([]);
    } catch (e) {
      setAiError(getErrorMessage(e));
    }
  }

  function updateGrams(index: number, grams: number) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, grams } : ing)),
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    try {
      await onSubmit({ name: name.trim(), servings, ingredients });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Overnight oats"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-2xl field-input"
            />
          </div>
          <div className="w-24 flex-shrink-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Servings
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 1)}
              className="h-11 w-full rounded-2xl field-input"
            />
          </div>
        </div>
      </div>

      {totalMacros ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Total ({ingredients.length} ingredient
            {ingredients.length !== 1 ? "s" : ""})
          </p>
          <MacroTileGrid
            calories={totalMacros.calories}
            protein={totalMacros.protein}
            carb={totalMacros.carb}
            fat={totalMacros.fat}
          />
          {perServing && servings !== 1 ? (
            <>
              <p className="mt-3 mb-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Per serving
              </p>
              <MacroTileGrid
                calories={perServing.calories}
                protein={perServing.protein}
                carb={perServing.carb}
                fat={perServing.fat}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Ingredients
        </p>
        {ingredients.length === 0 ? (
          <p className="text-sm text-stone-400">
            No ingredients yet — search below to add one.
          </p>
        ) : (
          <ul className="mb-1">
            {ingredients.map((ing, i) => (
              <li
                key={`${ing.foodId}-${i}`}
                className="flex items-center gap-2.5 border-t border-stone-100 py-2 first:border-t-0"
              >
                <FoodTile size={32} />
                <span className="flex-1 truncate text-[13.5px] font-semibold">
                  {ing.foodName}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={ing.grams}
                  onChange={(e) => updateGrams(i, Number(e.target.value) || 0)}
                  className="h-8 w-16 rounded-xl field-input text-center"
                />
                <span className="text-xs font-medium text-stone-500">g</span>
                <button
                  type="button"
                  aria-label="Remove"
                  className="rounded-lg p-1 text-stone-400 active:scale-90"
                  onClick={() => removeIngredient(i)}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          type="text"
          placeholder="Search foods to add…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2 h-11 w-full rounded-2xl field-input"
        />
        {searchResults.length > 0 ? (
          <ul className="mt-1.5 overflow-hidden rounded-2xl bg-stone-50">
            {searchResults.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => addIngredient(food)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium hover:bg-stone-100"
                >
                  <FoodTile size={28} />
                  {food.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {query.trim() && searchResults.length === 0 ? (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={handleAiSearch}
              disabled={isAiSearching}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary-200 bg-primary-50 py-2.5 text-[12.5px] font-bold text-primary-700 disabled:opacity-60"
            >
              <Sparkles size={14} />
              {isAiSearching ? "Searching…" : "Not in the list? Search with AI"}
            </button>
            {aiError ? <p className="mt-1.5 text-xs text-red-600">{aiError}</p> : null}
            {aiResults.length > 0 ? (
              <ul className="mt-1.5 overflow-hidden rounded-2xl bg-stone-50">
                {aiResults.map((food, i) => (
                  <li key={`ai-${i}`}>
                    <button
                      type="button"
                      onClick={() => addAiIngredient(food)}
                      disabled={confirmLlmFood.isPending}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium hover:bg-stone-100 disabled:opacity-60"
                    >
                      <FoodTile size={28} />
                      {food.name}
                      <span className="ml-auto rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-700">
                        AI est.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button
          className="rounded-2xl shadow-glow"
          onClick={handleSubmit}
          disabled={isSubmitting || !isDirty}
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Button variant="outline" className="rounded-2xl" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete ? (
          <button
            type="button"
            className="ml-auto text-sm font-semibold text-red-600"
            onClick={onDelete}
          >
            Delete meal
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Same 4-tile tinted grid as the quantity sheet / Add screen's totals bar —
// the dish form's summary should read as the same "macro preview" pattern
// wherever it appears, not a bespoke one-off.
function MacroTileGrid({
  calories,
  protein,
  carb,
  fat,
}: {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs">
      <div className="rounded-2xl bg-primary-50 py-2.5">
        <div className="text-base font-extrabold text-primary-700">{Math.round(calories)}</div>
        <div className="text-[9.5px] font-semibold text-stone-500">kcal</div>
      </div>
      <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-protein-bg)" }}>
        <div className="text-base font-extrabold" style={{ color: "var(--color-protein)" }}>
          {protein.toFixed(1)}
        </div>
        <div className="text-[9.5px] font-semibold text-stone-500">protein</div>
      </div>
      <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-carbs-bg)" }}>
        <div className="text-base font-extrabold" style={{ color: "var(--color-carbs)" }}>
          {carb.toFixed(1)}
        </div>
        <div className="text-[9.5px] font-semibold text-stone-500">carb</div>
      </div>
      <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-fat-bg)" }}>
        <div className="text-base font-extrabold" style={{ color: "var(--color-fat)" }}>
          {fat.toFixed(1)}
        </div>
        <div className="text-[9.5px] font-semibold text-stone-500">fat</div>
      </div>
    </div>
  );
}
