export type MealSlot =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "evening_snack"
  | "dinner";

export const MEAL_SLOTS: MealSlot[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "evening_snack",
  "dinner",
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  morning_snack: "Morning snack",
  lunch: "Lunch",
  evening_snack: "Evening snack",
  dinner: "Dinner",
};

export interface LogEntry {
  id: number;
  consumedAt: string;
  consumedDate: string;
  meal: MealSlot;
  refType: "food" | "dish";
  foodId: number | null;
  dishId: number | null;
  portionId: number | null;
  quantity: number;
  grams: number;
  enteredState: "raw" | "cooked";
  enteredGrams: number;
  yieldFactor: number;
  note: string | null;
  foodName: string | null;
  dishName: string | null;
  calories: number;
  protein: number;
  carb: number;
  fat: number;
  // True when a yield conversion was applied (entered as cooked) or the
  // underlying food's energy is Atwater-derived rather than measured.
  // CLAUDE.md provenance rules: estimated values must be visually
  // distinguished and counted in the day's coverage line.
  isEstimated: boolean;
}

export interface CreateLogEntryInput {
  consumedAt: string;
  consumedDate: string;
  meal: MealSlot;
  foodId: number;
  portionId: number | null;
  quantity: number;
  enteredState: "raw" | "cooked";
  enteredGrams: number;
  note?: string;
}

export interface UpdateLogEntryInput {
  id: number;
  meal: MealSlot;
  quantity: number;
  enteredState: "raw" | "cooked";
  enteredGrams: number;
  note?: string;
}
