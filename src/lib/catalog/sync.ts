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

async function getRemoteVersion(): Promise<number> {
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
