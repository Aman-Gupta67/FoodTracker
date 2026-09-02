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
  // Set only for entries created together by one "Log this" bulk action
  // (see create_log_entries_bulk) — entries sharing the same aiGroupId
  // collapse into a single card on Home, named by aiGroupDescription (the
  // original "Describe what you ate" text).
  aiGroupId: string | null;
  aiGroupDescription: string | null;
  calories: number;
  protein: number;
  carb: number;
  fat: number;
  // True when a yield conversion was applied (entered as cooked) or the
  // underlying food's energy is Atwater-derived rather than measured.
  // CLAUDE.md provenance rules: estimated values must be visually
  // distinguished and counted in the day's coverage line.
  isEstimated: boolean;
  // Optimistic-UI placeholder: true only for the brief window between
  // tapping Log and the server confirming — never persisted, never read
  // from the DB. The row renders a shimmer instead of (possibly wrong)
  // numbers, rather than guessing at nutrient values client-side.
  isPending?: boolean;
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

// One item of a bulk "Log this" commit — see create_log_entries_bulk.
export interface BulkLogEntryInput {
  foodId: number;
  portionId: number | null;
  quantity: number;
  enteredState: "raw" | "cooked";
  enteredGrams: number;
  consumedAt: string;
  consumedDate: string;
  meal: MealSlot;
  note?: string;
}
