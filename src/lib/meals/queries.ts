import { createClient, getAuthedClient } from "@/lib/supabase/client";
import { getFoodNutrientsByKey } from "@/lib/catalog/food-detail";
import type { Dish, DishIngredient, DishNutrients, MacroSet } from "./types";

interface RawDishIngredientRow {
  id: number;
  food_id: number;
  grams: number;
  sort_order: number;
  food: { name: string } | null;
}

interface RawDishRow {
  id: number;
  name: string;
  servings: number;
  yield_grams: number | null;
  notes: string | null;
  my_dish_ingredient: RawDishIngredientRow[];
}

function mapDish(r: RawDishRow): Dish {
  const ingredients: DishIngredient[] = r.my_dish_ingredient
    .map((i) => ({
      id: i.id,
      foodId: i.food_id,
      foodName: i.food?.name ?? "Unknown",
      grams: i.grams,
      sortOrder: i.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: r.id,
    name: r.name,
    servings: r.servings,
    yieldGrams: r.yield_grams,
    notes: r.notes,
    ingredients,
  };
}

export async function fetchDishes(): Promise<Dish[]> {
  const authed = await getAuthedClient();
  if (!authed) return [];
  const { data, error } = await authed.supabase
    .from("my_dish")
    .select(
      "id, name, servings, yield_grams, notes, my_dish_ingredient(id, food_id, grams, sort_order, food:food_id(name))",
    )
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as unknown as RawDishRow[]).map(mapDish);
}

export async function fetchDish(dishId: number): Promise<Dish | null> {
  const authed = await getAuthedClient();
  if (!authed) return null;
  const { data, error } = await authed.supabase
    .from("my_dish")
    .select(
      "id, name, servings, yield_grams, notes, my_dish_ingredient(id, food_id, grams, sort_order, food:food_id(name))",
    )
    .eq("id", dishId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDish(data as unknown as RawDishRow) : null;
}

// Computed offline from the cached catalog — dish composition (ingredients
// + grams) is small personal data, and per-100g nutrient values are already
// in Dexie, so this never needs a live round trip. Mirrors the exact
// dish_total/per_serving formula in nutrition-tracker-schema.md §5.
export async function computeMacrosForIngredients(
  ingredients: { foodId: number; grams: number }[],
): Promise<MacroSet> {
  const perIngredient = await Promise.all(
    ingredients.map(async (ing) => {
      const nutrients = await getFoodNutrientsByKey(ing.foodId);
      const factor = ing.grams / 100;
      return {
        calories: (nutrients.energy ?? 0) * factor,
        protein: (nutrients.protein ?? 0) * factor,
        carb: (nutrients.carb ?? 0) * factor,
        fat: (nutrients.fat ?? 0) * factor,
      };
    }),
  );

  return perIngredient.reduce(
    (sum, n) => ({
      calories: sum.calories + n.calories,
      protein: sum.protein + n.protein,
      carb: sum.carb + n.carb,
      fat: sum.fat + n.fat,
    }),
    { calories: 0, protein: 0, carb: 0, fat: 0 },
  );
}

export async function computeDishNutrients(dish: Dish): Promise<DishNutrients> {
  const total = await computeMacrosForIngredients(dish.ingredients);
  const servings = dish.servings || 1;
  const perServing: MacroSet = {
    calories: total.calories / servings,
    protein: total.protein / servings,
    carb: total.carb / servings,
    fat: total.fat / servings,
  };

  return { total, perServing };
}

export interface NewDishIngredient {
  foodId: number;
  grams: number;
}

// Blank-slate meal builder: name + servings + a from-scratch ingredient
// list, each ingredient resolved from the catalog with its own quantity.
export async function createDish(input: {
  name: string;
  servings: number;
  ingredients: NewDishIngredient[];
}): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: dish, error: dishError } = await supabase
    .from("my_dish")
    .insert({ user_id: user.id, name: input.name, servings: input.servings })
    .select("id")
    .single();
  if (dishError) throw dishError;

  const ingredients = input.ingredients;

  const rows = ingredients.map((ing, i) => ({
    dish_id: dish.id,
    food_id: ing.foodId,
    grams: ing.grams,
    sort_order: i,
  }));
  const { error: ingredientError } = await supabase
    .from("my_dish_ingredient")
    .insert(rows);
  if (ingredientError) throw ingredientError;

  return dish.id as number;
}

export async function updateDish(
  dishId: number,
  input: { name: string; servings: number; ingredients: NewDishIngredient[] },
): Promise<void> {
  const supabase = createClient();

  const { error: dishError } = await supabase
    .from("my_dish")
    .update({
      name: input.name,
      servings: input.servings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dishId);
  if (dishError) throw dishError;

  // Replace ingredients wholesale — simpler and safer than diffing, and
  // this never touches log_entry_nutrient (already-logged entries keep
  // their frozen snapshot regardless of what happens here).
  const { error: deleteError } = await supabase
    .from("my_dish_ingredient")
    .delete()
    .eq("dish_id", dishId);
  if (deleteError) throw deleteError;

  const rows = input.ingredients.map((ing, i) => ({
    dish_id: dishId,
    food_id: ing.foodId,
    grams: ing.grams,
    sort_order: i,
  }));
  const { error: insertError } = await supabase
    .from("my_dish_ingredient")
    .insert(rows);
  if (insertError) throw insertError;
}

export async function deleteDish(dishId: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("my_dish").delete().eq("id", dishId);
  if (error) throw error;
}
