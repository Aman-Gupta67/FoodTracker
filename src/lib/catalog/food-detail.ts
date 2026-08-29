import { catalogDb } from "./db";
import type { NutrientKey } from "@/lib/providers/types";

export async function getFoodNutrientsByKey(
  foodId: number,
): Promise<Partial<Record<NutrientKey, number>>> {
  const [values, nutrients] = await Promise.all([
    catalogDb.foodNutrient.where("foodId").equals(foodId).toArray(),
    catalogDb.nutrient.toArray(),
  ]);
  const keyById = new Map(nutrients.map((n) => [n.id, n.key as NutrientKey]));

  const result: Partial<Record<NutrientKey, number>> = {};
  for (const v of values) {
    const key = keyById.get(v.nutrientId);
    if (key) result[key] = v.amount;
  }
  return result;
}

export async function getFoodAliases(foodId: number): Promise<string[]> {
  const rows = await catalogDb.foodAlias.where("foodId").equals(foodId).toArray();
  return rows.map((r) => r.alias);
}

export async function getFoodPortions(
  foodId: number,
): Promise<{ label: string; grams: number }[]> {
  const portions = await getFoodPortionsWithId(foodId);
  return portions.map((p) => ({ label: p.label, grams: p.grams }));
}

// FoodCandidate.portions (mvp-build-plan.md §5) is deliberately
// provider-agnostic — {label, grams}, no id, since a candidate from a
// future OFF/FDC provider won't have a local food_portion row. But
// log_entry.portion_id needs a real id, which only exists once a food is
// actually in the local catalog. Callers that need to persist which
// portion was chosen (the quantity sheet) use this instead of the
// FoodCandidate shape.
export async function getFoodPortionsWithId(
  foodId: number,
): Promise<{ id: number; label: string; grams: number }[]> {
  const portions = await catalogDb.foodPortion
    .where("foodId")
    .equals(foodId)
    .toArray();
  return portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams }));
}
