import { searchFoodByAlias } from "@/lib/catalog/search";
import { catalogDb } from "@/lib/catalog/db";
import { getFoodNutrientsByKey, getFoodPortions } from "@/lib/catalog/food-detail";
import type { FoodCandidate, FoodProvider, FoodQuery } from "./types";

async function hydrateCandidate(
  foodId: number,
  name: string,
  sourceRef: string | null,
): Promise<FoodCandidate> {
  const [nutrients, portions] = await Promise.all([
    getFoodNutrientsByKey(foodId),
    getFoodPortions(foodId),
  ]);
  return {
    id: String(foodId),
    name,
    nutrients,
    portions,
    provenance: {
      source: "ifct2017",
      confidence: "measured",
      sourceRef: sourceRef ?? undefined,
    },
    needsConfirmation: false,
  };
}

// Recents/frequents lists only carry {foodId, name, sourceRef} — this
// hydrates one into a full FoodCandidate when the quantity sheet needs it.
export async function getFoodCandidateById(
  foodId: number,
): Promise<FoodCandidate | null> {
  const food = await catalogDb.food.get(foodId);
  if (!food) return null;
  return hydrateCandidate(foodId, food.name, food.sourceRef);
}

// The MVP's only registered provider. Open Food Facts / FDC / LLM
// decomposition register alongside this later — the resolver in
// resolve.ts is what makes that a registration, not a refactor.
export class LocalCatalogProvider implements FoodProvider {
  readonly id = "ifct2017" as const;
  readonly priority = 0;

  canHandle(_q: FoodQuery): boolean {
    return true;
  }

  async search(q: FoodQuery, signal: AbortSignal): Promise<FoodCandidate[]> {
    const matches = await searchFoodByAlias(q.text);
    if (signal.aborted) return [];

    return Promise.all(
      matches.map((m) => hydrateCandidate(m.foodId, m.name, m.sourceRef)),
    );
  }
}
