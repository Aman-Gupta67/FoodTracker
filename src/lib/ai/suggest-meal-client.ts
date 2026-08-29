import { fetchTopLoggedFoodsAllMeals, type FoodShortcut } from "@/lib/log/queries";
import { searchFoodByAlias } from "@/lib/catalog/search";
import { getFoodCandidateById } from "@/lib/providers/local-catalog-provider";
import { getFoodNutrientsByKey } from "@/lib/catalog/food-detail";
import type { ConsumedToday } from "./suggest-meal";
import type { ResolvedMealItem } from "./resolve-parsed-items";

export interface RemainingTargets {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

// A brand-new user has no logging history to draw candidates from — these
// common staples (resolved through the same alias search as manual
// logging) keep the feature usable from day one instead of failing empty.
const STAPLE_FALLBACK_QUERIES = [
  "rice",
  "dal",
  "atta",
  "egg",
  "milk",
  "banana",
  "curd",
  "spinach",
  "chicken",
  "paneer",
];

async function buildCandidatePool() {
  const shortcuts: FoodShortcut[] = await fetchTopLoggedFoodsAllMeals(30);

  if (shortcuts.length < 5) {
    const seen = new Set(shortcuts.map((s) => s.foodId));
    for (const q of STAPLE_FALLBACK_QUERIES) {
      const matches = await searchFoodByAlias(q);
      const top = matches[0];
      if (top && !seen.has(top.foodId)) {
        shortcuts.push({
          foodId: top.foodId,
          name: top.name,
          sourceRef: top.sourceRef,
        });
        seen.add(top.foodId);
      }
    }
  }

  return Promise.all(
    shortcuts.map(async (s) => {
      const nutrients = await getFoodNutrientsByKey(s.foodId);
      return {
        id: s.foodId,
        name: s.name,
        energy: nutrients.energy ?? 0,
        protein: nutrients.protein ?? 0,
        fat: nutrients.fat ?? 0,
        carb: nutrients.carb ?? 0,
      };
    }),
  );
}

export async function requestMealSuggestion(
  targets: RemainingTargets,
  consumedToday: ConsumedToday,
): Promise<{ items: ResolvedMealItem[]; reasoning: string }> {
  const candidates = await buildCandidatePool();
  if (candidates.length === 0) {
    throw new Error(
      "Not enough foods to suggest from yet — log a few things first.",
    );
  }

  const res = await fetch("/api/ai/suggest-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targets, candidates, consumedToday }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Could not get a suggestion.");
  }

  const suggested: { id: number; grams: number }[] = body.items;
  const resolved: ResolvedMealItem[] = [];
  for (const item of suggested) {
    const candidate = await getFoodCandidateById(item.id);
    if (candidate) resolved.push({ candidate, grams: item.grams });
  }

  return { items: resolved, reasoning: body.reasoning ?? "" };
}
