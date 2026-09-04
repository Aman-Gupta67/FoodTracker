import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { catalogDb, clearCatalog } from "./db";
import {
  mapFood,
  mapFoodAlias,
  mapFoodNutrient,
  mapFoodPortion,
  mapNutrient,
  type RawFoodAliasRow,
  type RawFoodNutrientRow,
  type RawFoodPortionRow,
  type RawFoodRow,
  type RawNutrientRow,
} from "./types";

export interface SyncResult {
  synced: boolean;
  version: number;
}

export async function getRemoteVersion(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalog_version")
    .select("version")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data.version as number;
}

async function getLocalVersion(): Promise<number | null> {
  const row = await catalogDb.meta.get("version");
  return row ? row.value : null;
}

// Full-refetch-and-replace: the whole catalog is ~2 MB (storage projection
// in nutrition-tracker-schema.md §6), so there's no reason to diff — pull
// everything, compare the version stamp, and only write if it moved.
export async function syncCatalogIfStale(): Promise<SyncResult> {
  const remoteVersion = await getRemoteVersion();
  const localVersion = await getLocalVersion();

  if (localVersion === remoteVersion) {
    return { synced: false, version: remoteVersion };
  }

  const supabase = createClient();
  const [nutrients, foods, aliases, nutrientValues, portions] =
    await Promise.all([
      fetchAllRows<RawNutrientRow>(supabase, "nutrient"),
      fetchAllRows<RawFoodRow>(supabase, "food"),
      fetchAllRows<RawFoodAliasRow>(supabase, "food_alias"),
      fetchAllRows<RawFoodNutrientRow>(supabase, "food_nutrient"),
      fetchAllRows<RawFoodPortionRow>(supabase, "food_portion"),
    ]);

  await clearCatalog();
  await catalogDb.transaction(
    "rw",
    [
      catalogDb.nutrient,
      catalogDb.food,
      catalogDb.foodAlias,
      catalogDb.foodNutrient,
      catalogDb.foodPortion,
      catalogDb.meta,
    ],
    async () => {
      await catalogDb.nutrient.bulkAdd(nutrients.map(mapNutrient));
      await catalogDb.food.bulkAdd(foods.map(mapFood));
      await catalogDb.foodAlias.bulkAdd(aliases.map(mapFoodAlias));
      await catalogDb.foodNutrient.bulkAdd(nutrientValues.map(mapFoodNutrient));
      await catalogDb.foodPortion.bulkAdd(portions.map(mapFoodPortion));
      await catalogDb.meta.put({ key: "version", value: remoteVersion });
    },
  );

  return { synced: true, version: remoteVersion };
}

// Every catalog_version bump comes from one of exactly four write paths —
// confirm_llm_food(s), confirm_off_food, add_food_aliases — each of which
// already knows precisely which food(s) changed. Re-running the full
// syncCatalogIfStale() after any of them means re-downloading and
// rewriting the ENTIRE catalog (600+ foods, 16k+ nutrient rows) just to
// pick up one new/updated food — and since bulk AI-logging makes
// confirming several new foods a routine, fast action now, that full
// resync started firing on nearly every visit to Add, which is what made
// it feel slow. This folds in just what changed and advances the local
// version marker to match remote, so syncCatalogIfStale()'s own mount-time
// check finds nothing stale and does no work.
export async function syncFoodsIntoLocalCatalog(foodIds: number[]): Promise<void> {
  if (foodIds.length === 0) return;
  const supabase = createClient();
  const [foodResult, nutrientResult, remoteVersion] = await Promise.all([
    supabase.from("food").select("*").in("id", foodIds),
    supabase.from("food_nutrient").select("*").in("food_id", foodIds),
    getRemoteVersion(),
  ]);
  if (foodResult.error) throw foodResult.error;
  if (nutrientResult.error) throw nutrientResult.error;

  await catalogDb.transaction(
    "rw",
    [catalogDb.food, catalogDb.foodNutrient, catalogDb.meta],
    async () => {
      await catalogDb.food.bulkPut((foodResult.data as RawFoodRow[]).map(mapFood));
      // foodNutrient rows are Dexie-auto-keyed (no natural id from
      // Postgres), so a re-confirmed food's updated amounts have to
      // replace the old rows outright rather than risk duplicating them.
      await catalogDb.foodNutrient.where("foodId").anyOf(foodIds).delete();
      await catalogDb.foodNutrient.bulkAdd(
        (nutrientResult.data as RawFoodNutrientRow[]).map(mapFoodNutrient),
      );
      await catalogDb.meta.put({ key: "version", value: remoteVersion });
    },
  );
}

// Same reasoning, for add_food_aliases (which only ever adds rows to an
// existing food, never touches `food`/`food_nutrient`).
export async function syncFoodAliasesIntoLocalCatalog(foodId: number): Promise<void> {
  const supabase = createClient();
  const [aliasResult, remoteVersion] = await Promise.all([
    supabase.from("food_alias").select("*").eq("food_id", foodId),
    getRemoteVersion(),
  ]);
  if (aliasResult.error) throw aliasResult.error;

  await catalogDb.transaction("rw", [catalogDb.foodAlias, catalogDb.meta], async () => {
    await catalogDb.foodAlias.where("foodId").equals(foodId).delete();
    await catalogDb.foodAlias.bulkAdd(
      (aliasResult.data as RawFoodAliasRow[]).map(mapFoodAlias),
    );
    await catalogDb.meta.put({ key: "version", value: remoteVersion });
  });
}
