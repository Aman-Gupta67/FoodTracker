export interface DishIngredient {
  id: number;
  foodId: number;
  foodName: string;
  grams: number;
  sortOrder: number;
}

export interface Dish {
  id: number;
  name: string;
  servings: number;
  yieldGrams: number | null;
  notes: string | null;
  ingredients: DishIngredient[];
}

export interface MacroSet {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface DishNutrients {
  total: MacroSet;
  perServing: MacroSet;
}
