"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveFoodCandidates } from "@/lib/providers/resolve";
import type { FoodCandidate } from "@/lib/providers/types";
import { useIngredientMacros } from "@/lib/meals/hooks";
import type { NewDishIngredient } from "@/lib/meals/queries";
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
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">
          Name
        </label>
        <input
          type="text"
          placeholder="e.g. Overnight oats"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full field-input"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">
          Servings (this recipe as a whole yields this many)
        </label>
        <input
          type="number"
          min={1}
          step="any"
          value={servings}
          onChange={(e) => setServings(Number(e.target.value) || 1)}
          className="h-10 w-32 field-input"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-stone-600">Ingredients</p>
        {ingredients.length === 0 ? (
          <p className="text-sm text-stone-400">
            No ingredients yet — search below to add one.
          </p>
        ) : (
          <ul>
            {ingredients.map((ing, i) => (
              <li
                key={`${ing.foodId}-${i}`}
                className="flex items-center gap-2 border-b border-stone-100 py-2"
              >
                <span className="flex-1 text-sm">{ing.foodName}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={ing.grams}
                  onChange={(e) => updateGrams(i, Number(e.target.value) || 0)}
                  className="h-8 w-20 field-input"
                />
                <span className="text-xs text-stone-500">g</span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => removeIngredient(i)}
                >
                  Remove
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
          className="mt-3 h-10 w-full field-input"
        />
        {searchResults.length > 0 ? (
          <ul className="mt-1 rounded-md border border-stone-200">
            {searchResults.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => addIngredient(food)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  {food.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {totalMacros ? (
        <div className="rounded-md bg-stone-100 p-3 text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
            Total ({ingredients.length} ingredient
            {ingredients.length !== 1 ? "s" : ""})
          </p>
          <p>{Math.round(totalMacros.calories)} kcal</p>
          <p className="text-xs text-stone-600">
            P {totalMacros.protein.toFixed(1)}g · C {totalMacros.carb.toFixed(1)}g · F{" "}
            {totalMacros.fat.toFixed(1)}g
          </p>
          {perServing && servings !== 1 ? (
            <>
              <p className="mt-2 mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                Per serving
              </p>
              <p>{Math.round(perServing.calories)} kcal</p>
              <p className="text-xs text-stone-600">
                P {perServing.protein.toFixed(1)}g · C {perServing.carb.toFixed(1)}g · F{" "}
                {perServing.fat.toFixed(1)}g
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete ? (
          <button
            type="button"
            className="ml-auto text-sm text-red-600"
            onClick={onDelete}
          >
            Delete meal
          </button>
        ) : null}
      </div>
    </div>
  );
}
