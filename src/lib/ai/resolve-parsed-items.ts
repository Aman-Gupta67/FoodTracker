import { searchFoodByAlias } from "@/lib/catalog/search";
import { getFoodCandidateById } from "@/lib/providers/local-catalog-provider";
import type { FoodCandidate } from "@/lib/providers/types";

export interface ParsedMealItem {
  query: string;
  grams: number;
  nutrientsPer100g: {
    energy: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
  };
}

export interface ResolvedMealItem {
  candidate: FoodCandidate;
  grams: number;
}

// Per-item: prefer a real catalog match (alias/name search, same as manual
// search) over the LLM's own estimate. The LLM has no visibility into what
// this catalog actually contains, so it always supplies a nutrient guess —
// that guess is only used as a fallback for items the catalog doesn't have.
export async function resolveParsedItems(
  items: ParsedMealItem[],
): Promise<ResolvedMealItem[]> {
  const resolved: ResolvedMealItem[] = [];

  for (const item of items) {
    const matches = await searchFoodByAlias(item.query);
    const topMatch = matches[0];
    const candidate = topMatch
      ? await getFoodCandidateById(topMatch.foodId)
      : null;

    if (candidate) {
      resolved.push({ candidate, grams: item.grams });
      continue;
    }

    resolved.push({
      candidate: {
        name: item.query,
        nutrients: { ...item.nutrientsPer100g },
        portions: [],
        provenance: {
          source: "llm",
          confidence: "estimated",
          rawPayload: item,
        },
        needsConfirmation: true,
      },
      grams: item.grams,
    });
  }

  return resolved;
}
