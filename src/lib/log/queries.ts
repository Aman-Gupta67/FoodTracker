import { createClient, getAuthedClient, type AuthedClient } from "@/lib/supabase/client";
import { getTodayDateString, shiftDateString } from "@/lib/date";
import { NUTRIENT_KEYS, type NutrientKey } from "@/lib/providers/types";
import type {
  BulkLogEntryInput,
  CreateLogEntryInput,
  LogEntry,
  MealSlot,
  UpdateLogEntryInput,
} from "./types";

// Nutrient ids from out/seed_nutrient.sql — fetched via the embedded
// snapshot rather than re-deriving from food_nutrient, since
// log_entry_nutrient is the authoritative snapshot for what was logged.
const NUTRIENT_ID = { energy: 1, protein: 2, fat: 3, carb: 4 } as const;

const LOG_ENTRY_SELECT =
  "*, food:food_id(name, source_ref, energy_source, fetch_confidence), dish:dish_id(name), ai_meal_group:ai_group_id(description), log_entry_nutrient(nutrient_id, amount)";

interface RawLogEntryRow {
  id: number;
  consumed_at: string;
  consumed_date: string;
  meal: MealSlot;
  ref_type: "food" | "dish";
  food_id: number | null;
  dish_id: number | null;
  portion_id: number | null;
  quantity: number;
  grams: number;
  entered_state: "raw" | "cooked";
  entered_grams: number;
  yield_factor: number;
  note: string | null;
  ai_group_id: string | null;
  food: {
    name: string;
    source_ref: string | null;
    energy_source: string;
    fetch_confidence: string | null;
  } | null;
  dish: { name: string } | null;
  ai_meal_group: { description: string } | null;
  log_entry_nutrient: { nutrient_id: number; amount: number }[];
}

function findNutrient(
  values: { nutrient_id: number; amount: number }[],
  nutrientId: number,
): number {
  return values.find((n) => n.nutrient_id === nutrientId)?.amount ?? 0;
}

function mapRow(r: RawLogEntryRow): LogEntry {
  return {
    id: r.id,
    consumedAt: r.consumed_at,
    consumedDate: r.consumed_date,
    meal: r.meal,
    refType: r.ref_type,
    foodId: r.food_id,
    dishId: r.dish_id,
    portionId: r.portion_id,
    quantity: r.quantity,
    grams: r.grams,
    enteredState: r.entered_state,
    enteredGrams: r.entered_grams,
    yieldFactor: r.yield_factor,
    note: r.note,
    foodName: r.food?.name ?? null,
    dishName: r.dish?.name ?? null,
    aiGroupId: r.ai_group_id,
    aiGroupDescription: r.ai_meal_group?.description ?? null,
    calories: findNutrient(r.log_entry_nutrient, NUTRIENT_ID.energy),
    protein: findNutrient(r.log_entry_nutrient, NUTRIENT_ID.protein),
    carb: findNutrient(r.log_entry_nutrient, NUTRIENT_ID.carb),
    fat: findNutrient(r.log_entry_nutrient, NUTRIENT_ID.fat),
    isEstimated:
      r.entered_state === "cooked" ||
      r.food?.energy_source === "derived_atwater" ||
      r.food?.fetch_confidence === "estimated",
  };
}

export async function fetchLogEntriesForDate(
  consumedDate: string,
): Promise<LogEntry[]> {
  const authed = await getAuthedClient();
  if (!authed) return [];
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select(LOG_ENTRY_SELECT)
    .eq("consumed_date", consumedDate)
    .order("consumed_at", { ascending: true });

  if (error) throw error;
  return (data as unknown as RawLogEntryRow[]).map(mapRow);
}

// Daily calorie totals for a date range (History's 7-day strip + day list).
// Grouped client-side from a bounded range query — same reasoning as
// recents/frequents: trivial data volume at single-user MVP scale.
export async function fetchDailyCalorieTotals(
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const authed = await getAuthedClient();
  if (!authed) return {};
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("consumed_date, log_entry_nutrient(nutrient_id, amount)")
    .gte("consumed_date", startDate)
    .lte("consumed_date", endDate);

  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of data as unknown as {
    consumed_date: string;
    log_entry_nutrient: { nutrient_id: number; amount: number }[];
  }[]) {
    const energy = findNutrient(row.log_entry_nutrient, NUTRIENT_ID.energy);
    totals[row.consumed_date] = (totals[row.consumed_date] ?? 0) + energy;
  }
  return totals;
}

export interface DailyMacroTotal {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

// Day-by-day calories + macros for the Dashboard's KPI trend charts — same
// query shape as fetchDailyCalorieTotals, generalized to all four nutrients
// instead of just energy.
export async function fetchDailyMacroTotals(
  startDate: string,
  endDate: string,
  // Callers that fire several reads together (the Dashboard) pass an
  // already-resolved client to share one auth check instead of paying its
  // round-trip again here.
  preAuthed?: AuthedClient,
): Promise<Record<string, DailyMacroTotal>> {
  const authed = preAuthed ?? (await getAuthedClient());
  if (!authed) return {};
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("consumed_date, log_entry_nutrient(nutrient_id, amount)")
    .gte("consumed_date", startDate)
    .lte("consumed_date", endDate);

  if (error) throw error;

  const totals: Record<string, DailyMacroTotal> = {};
  for (const row of data as unknown as {
    consumed_date: string;
    log_entry_nutrient: { nutrient_id: number; amount: number }[];
  }[]) {
    const existing = totals[row.consumed_date] ?? {
      calories: 0,
      protein: 0,
      carb: 0,
      fat: 0,
    };
    totals[row.consumed_date] = {
      calories: existing.calories + findNutrient(row.log_entry_nutrient, NUTRIENT_ID.energy),
      protein: existing.protein + findNutrient(row.log_entry_nutrient, NUTRIENT_ID.protein),
      carb: existing.carb + findNutrient(row.log_entry_nutrient, NUTRIENT_ID.carb),
      fat: existing.fat + findNutrient(row.log_entry_nutrient, NUTRIENT_ID.fat),
    };
  }
  return totals;
}

// Full nutrient breakdown for a single day (all 30 nutrient keys, not just
// the four macros) — feeds the AI day-analysis report. Summed the same way
// findNutrient/mapRow do: a nutrient with no log_entry_nutrient row for a
// given entry simply doesn't contribute, which understates rather than
// fabricates a zero for a food IFCT never measured that nutrient on
// (CLAUDE.md "missing is NULL, never 0") — the AI prompt is told this.
export async function fetchDailyNutrientTotals(
  date: string,
): Promise<Partial<Record<NutrientKey, number>>> {
  const authed = await getAuthedClient();
  if (!authed) return {};
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("log_entry_nutrient(nutrient_id, amount)")
    .eq("consumed_date", date);

  if (error) throw error;

  const totals: Partial<Record<NutrientKey, number>> = {};
  for (const row of data as unknown as {
    log_entry_nutrient: { nutrient_id: number; amount: number }[];
  }[]) {
    for (const n of row.log_entry_nutrient) {
      const key = NUTRIENT_KEYS[n.nutrient_id - 1];
      if (!key) continue;
      totals[key] = (totals[key] ?? 0) + n.amount;
    }
  }
  return totals;
}

export interface FoodShortcut {
  foodId: number;
  name: string;
  sourceRef: string | null;
}

// Recents/frequents are computed client-side from a bounded recent window
// rather than a SQL aggregate — at single-user MVP scale (a few hundred
// entries per meal slot per year) this is simpler than a view/RPC and is
// nowhere near a performance concern.
const SHORTCUT_WINDOW = 500;

async function fetchFoodEntriesForSlot(
  meal: MealSlot,
): Promise<{ foodId: number; name: string; sourceRef: string | null; consumedAt: string }[]> {
  const authed = await getAuthedClient();
  if (!authed) return [];
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("food_id, consumed_at, food:food_id(name, source_ref)")
    .eq("meal", meal)
    .eq("ref_type", "food")
    .order("consumed_at", { ascending: false })
    .limit(SHORTCUT_WINDOW);

  if (error) throw error;
  return (
    data as unknown as {
      food_id: number;
      consumed_at: string;
      food: { name: string; source_ref: string | null } | null;
    }[]
  )
    .filter((r) => r.food)
    .map((r) => ({
      foodId: r.food_id,
      name: r.food!.name,
      sourceRef: r.food!.source_ref,
      consumedAt: r.consumed_at,
    }));
}

export async function fetchRecentFoods(
  meal: MealSlot,
  limit = 5,
): Promise<FoodShortcut[]> {
  const rows = await fetchFoodEntriesForSlot(meal);
  const seen = new Set<number>();
  const result: FoodShortcut[] = [];
  for (const r of rows) {
    if (seen.has(r.foodId)) continue;
    seen.add(r.foodId);
    result.push({ foodId: r.foodId, name: r.name, sourceRef: r.sourceRef });
    if (result.length >= limit) break;
  }
  return result;
}

const FREQUENT_MIN_COUNT = 3;
const FREQUENT_WINDOW_DAYS = 7;

// "Frequent" means logged at this meal slot at least 3 times in the last 7
// days — a real recurrence signal, not just "in your last 500 entries ever"
// (which could surface a food you ate daily for a month last year and
// haven't touched since).
export async function fetchFrequentFoods(
  meal: MealSlot,
  limit = 10,
): Promise<FoodShortcut[]> {
  const authed = await getAuthedClient();
  if (!authed) return [];
  const windowStart = shiftDateString(getTodayDateString(), -(FREQUENT_WINDOW_DAYS - 1));
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("food_id, consumed_date, food:food_id(name, source_ref)")
    .eq("meal", meal)
    .eq("ref_type", "food")
    .gte("consumed_date", windowStart);

  if (error) throw error;

  const counts = new Map<number, { count: number; shortcut: FoodShortcut }>();
  for (const r of data as unknown as {
    food_id: number;
    consumed_date: string;
    food: { name: string; source_ref: string | null } | null;
  }[]) {
    if (!r.food) continue;
    const existing = counts.get(r.food_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.food_id, {
        count: 1,
        shortcut: { foodId: r.food_id, name: r.food.name, sourceRef: r.food.source_ref },
      });
    }
  }
  return [...counts.values()]
    .filter((c) => c.count >= FREQUENT_MIN_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => c.shortcut);
}

// Candidate pool for goal-aware meal suggestions — top logged foods across
// all meal slots, not scoped to one. Same bounded-window-and-count-in-JS
// approach as fetchFrequentFoods, just without the meal filter.
export async function fetchTopLoggedFoodsAllMeals(
  limit = 30,
): Promise<FoodShortcut[]> {
  const authed = await getAuthedClient();
  if (!authed) return [];
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("food_id, food:food_id(name, source_ref)")
    .eq("ref_type", "food")
    .order("consumed_at", { ascending: false })
    .limit(SHORTCUT_WINDOW);

  if (error) throw error;

  const counts = new Map<number, { count: number; shortcut: FoodShortcut }>();
  for (const r of data as unknown as {
    food_id: number;
    food: { name: string; source_ref: string | null } | null;
  }[]) {
    if (!r.food) continue;
    const existing = counts.get(r.food_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.food_id, {
        count: 1,
        shortcut: {
          foodId: r.food_id,
          name: r.food.name,
          sourceRef: r.food.source_ref,
        },
      });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => c.shortcut);
}

// "Pre-fill with the last-used portion and quantity for this food" —
// mvp-build-plan.md §6.3.
export async function fetchLastLogForFood(foodId: number): Promise<{
  portionId: number | null;
  quantity: number;
  enteredState: "raw" | "cooked";
  enteredGrams: number;
} | null> {
  const authed = await getAuthedClient();
  if (!authed) return null;
  const { data, error } = await authed.supabase
    .from("log_entry")
    .select("portion_id, quantity, entered_state, entered_grams")
    .eq("food_id", foodId)
    .eq("ref_type", "food")
    .order("consumed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    portionId: data.portion_id,
    quantity: data.quantity,
    enteredState: data.entered_state,
    enteredGrams: data.entered_grams,
  };
}

export async function createLogEntry(
  input: CreateLogEntryInput,
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_log_entry", {
    p_consumed_at: input.consumedAt,
    p_consumed_date: input.consumedDate,
    p_meal: input.meal,
    p_ref_type: "food",
    p_food_id: input.foodId,
    p_dish_id: null,
    p_portion_id: input.portionId,
    p_quantity: input.quantity,
    p_entered_state: input.enteredState,
    p_entered_grams: input.enteredGrams,
    p_note: input.note ?? null,
  });

  if (error) throw error;
  return data as number;
}

export interface CreateDishLogEntryInput {
  consumedAt: string;
  consumedDate: string;
  meal: MealSlot;
  dishId: number;
  quantity: number; // servings logged
}

// entered_grams/entered_state don't have a natural meaning for a dish (no
// raw/cooked toggle, no single gram figure the user typed) — "what the user
// actually typed" for a dish is the serving count, so quantity and
// entered_grams both hold it, and entered_state is a fixed 'raw' to satisfy
// the column's NOT NULL/CHECK constraint. The RPC's dish branch ignores
// both for the actual gram/nutrient math, which comes entirely from
// my_dish_ingredient.
export async function createDishLogEntry(
  input: CreateDishLogEntryInput,
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_log_entry", {
    p_consumed_at: input.consumedAt,
    p_consumed_date: input.consumedDate,
    p_meal: input.meal,
    p_ref_type: "dish",
    p_food_id: null,
    p_dish_id: input.dishId,
    p_portion_id: null,
    p_quantity: input.quantity,
    p_entered_state: "raw",
    p_entered_grams: input.quantity,
    p_note: null,
  });

  if (error) throw error;
  return data as number;
}

// Bulk version of createLogEntry — one round trip for the whole "Log this"
// batch, atomic (a failure anywhere rolls back everything, so there's no
// partial-success state to reconcile on retry). p_description, when given,
// creates one ai_meal_group row shared by every entry in this call.
export async function createLogEntriesBulk(
  entries: BulkLogEntryInput[],
  description: string | null,
): Promise<number[]> {
  if (entries.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_log_entries_bulk", {
    p_entries: entries.map((e, idx) => ({
      idx,
      food_id: e.foodId,
      portion_id: e.portionId,
      quantity: e.quantity,
      entered_state: e.enteredState,
      entered_grams: e.enteredGrams,
      consumed_at: e.consumedAt,
      consumed_date: e.consumedDate,
      meal: e.meal,
      note: e.note ?? null,
    })),
    p_description: description,
  });
  if (error) throw error;
  return (data as { idx: number; entry_id: number }[])
    .sort((a, b) => a.idx - b.idx)
    .map((r) => r.entry_id);
}

export async function updateLogEntry(
  input: UpdateLogEntryInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_log_entry", {
    p_entry_id: input.id,
    p_meal: input.meal,
    p_quantity: input.quantity,
    p_entered_state: input.enteredState,
    p_entered_grams: input.enteredGrams,
    p_note: input.note ?? null,
  });

  if (error) throw error;
}

export async function deleteLogEntry(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("log_entry").delete().eq("id", id);
  if (error) throw error;
}
