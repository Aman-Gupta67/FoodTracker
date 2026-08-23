import Dexie, { type Table } from "dexie";
import type {
  CachedFood,
  CachedFoodAlias,
  CachedFoodNutrient,
  CachedFoodPortion,
  CachedNutrient,
} from "./types";

export interface CatalogMeta {
  key: string;
  value: number;
}

class CatalogDatabase extends Dexie {
  nutrient!: Table<CachedNutrient, number>;
  food!: Table<CachedFood, number>;
  foodAlias!: Table<CachedFoodAlias, number>;
  foodNutrient!: Table<CachedFoodNutrient, number>;
  foodPortion!: Table<CachedFoodPortion, number>;
  meta!: Table<CatalogMeta, string>;

  constructor() {
    super("food-tracker-catalog");
    this.version(1).stores({
      nutrient: "id, key",
      food: "id, sourceRef, name",
      foodAlias: "++id, foodId, alias",
      foodNutrient: "++id, foodId, nutrientId, [foodId+nutrientId]",
      foodPortion: "id, foodId",
      meta: "key",
    });
  }
}

export const catalogDb = new CatalogDatabase();

export async function clearCatalog() {
  await catalogDb.transaction(
    "rw",
    catalogDb.nutrient,
    catalogDb.food,
    catalogDb.foodAlias,
    catalogDb.foodNutrient,
    catalogDb.foodPortion,
    async () => {
      await Promise.all([
        catalogDb.nutrient.clear(),
        catalogDb.food.clear(),
        catalogDb.foodAlias.clear(),
        catalogDb.foodNutrient.clear(),
        catalogDb.foodPortion.clear(),
      ]);
    },
  );
}
