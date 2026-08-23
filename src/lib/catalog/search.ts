import { catalogDb } from "./db";
import type { CachedFood } from "./types";

export interface FoodSearchResult {
  foodId: number;
  name: string;
  sourceRef: string | null;
  matchedAlias: string;
}

function toResults(
  matches: { foodId: number; alias: string }[],
  foodById: Map<number, CachedFood>,
  seenFoodIds: Set<number>,
): FoodSearchResult[] {
  const results: FoodSearchResult[] = [];
  for (const match of matches) {
    if (seenFoodIds.has(match.foodId)) continue;
    const food = foodById.get(match.foodId);
    if (!food) continue;
    seenFoodIds.add(match.foodId);
    results.push({
      foodId: food.id,
      name: food.name,
      sourceRef: food.sourceRef,
      matchedAlias: match.alias,
    });
  }
  return results;
}

// mvp-build-plan.md §6.2: "case-insensitive prefix match on alias, then
// trigram similarity on name." Implemented as alias-first, name-second —
// but as a MERGE, not a stop-at-first-hit fallback: alias coverage is
// curated and incomplete (many foods are only aliased in regional
// languages, not in plain English), so a single unrelated alias hit — e.g.
// "milk" prefix-matching the alias "milkfish" — must never suppress a
// relevant name match ("Milk, whole, Cow") that would otherwise have been
// found. Alias matches are ranked first since they're precise; name matches
// fill in anything alias coverage missed, for foods not already matched.
//
// The name stage is a case-insensitive substring scan rather than real
// trigram similarity — at 542 foods a full in-memory scan is instant, and
// this catches the common case (query is a substring of the name) without
// needing a fuzzy-matching library.
export async function searchFoodByAlias(
  query: string,
): Promise<FoodSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const aliasMatches = await catalogDb.foodAlias
    .where("alias")
    .startsWithIgnoreCase(trimmed)
    .toArray();

  const aliasFoodIds = [...new Set(aliasMatches.map((m) => m.foodId))];
  const aliasFoods = await catalogDb.food.bulkGet(aliasFoodIds);
  const foodById = new Map<number, CachedFood>(
    aliasFoods.filter((f): f is CachedFood => f !== undefined).map((f) => [f.id, f]),
  );

  const seenFoodIds = new Set<number>();
  const results = toResults(aliasMatches, foodById, seenFoodIds);

  const lowerQuery = trimmed.toLowerCase();
  const allFoods = await catalogDb.food.toArray();
  const nameMatches = allFoods.filter(
    (f) => !seenFoodIds.has(f.id) && f.name.toLowerCase().includes(lowerQuery),
  );
  const nameFoodById = new Map<number, CachedFood>(
    nameMatches.map((f) => [f.id, f]),
  );
  results.push(
    ...toResults(
      nameMatches.map((f) => ({ foodId: f.id, alias: f.name })),
      nameFoodById,
      seenFoodIds,
    ),
  );

  return results;
}
