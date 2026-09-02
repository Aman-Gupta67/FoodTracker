import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDishLogEntry,
  createLogEntry,
  createLogEntriesBulk,
  deleteLogEntry,
  fetchDailyCalorieTotals,
  fetchDailyMacroTotals,
  fetchDailyNutrientTotals,
  fetchFrequentFoods,
  fetchLastLogForFood,
  fetchLogEntriesForDate,
  fetchRecentFoods,
  updateLogEntry,
  type CreateDishLogEntryInput,
} from "./queries";
import type {
  BulkLogEntryInput,
  CreateLogEntryInput,
  LogEntry,
  MealSlot,
  UpdateLogEntryInput,
} from "./types";

const logEntriesKey = (date: string) => ["log-entries", date] as const;

export function useLogEntries(date: string) {
  return useQuery({
    queryKey: logEntriesKey(date),
    queryFn: () => fetchLogEntriesForDate(date),
  });
}

export function useRecentFoods(meal: MealSlot) {
  return useQuery({
    queryKey: ["recent-foods", meal],
    queryFn: () => fetchRecentFoods(meal),
  });
}

export function useFrequentFoods(meal: MealSlot) {
  return useQuery({
    queryKey: ["frequent-foods", meal],
    queryFn: () => fetchFrequentFoods(meal),
  });
}

export function useLastLogForFood(foodId: number | null) {
  return useQuery({
    queryKey: ["last-log", foodId],
    queryFn: () => fetchLastLogForFood(foodId!),
    enabled: foodId !== null,
  });
}

export function useDailyCalorieTotals(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["daily-calorie-totals", startDate, endDate],
    queryFn: () => fetchDailyCalorieTotals(startDate, endDate),
  });
}

export function useDailyMacroTotals(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["daily-macro-totals", startDate, endDate],
    queryFn: () => fetchDailyMacroTotals(startDate, endDate),
  });
}

// Only fetched when the day-analysis sheet is actually open (enabled) —
// no reason to pay this extra query on every Home load.
export function useDailyNutrientTotals(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ["daily-nutrient-totals", date],
    queryFn: () => fetchDailyNutrientTotals(date),
    enabled,
  });
}

// A pending row appears the instant "Log" is tapped — a shimmer, not a
// guessed calorie number — and is replaced by the real row once the server
// confirms. This is the actual fix for "feels laggy": the wait was always
// there (the round trip), only the silence was the problem.
function buildPendingEntry(input: CreateLogEntryInput, tempId: number): LogEntry {
  return {
    id: tempId,
    consumedAt: input.consumedAt,
    consumedDate: input.consumedDate,
    meal: input.meal,
    refType: "food",
    foodId: input.foodId,
    dishId: null,
    portionId: input.portionId,
    quantity: input.quantity,
    grams: input.enteredGrams,
    enteredState: input.enteredState,
    enteredGrams: input.enteredGrams,
    yieldFactor: 1,
    note: input.note ?? null,
    foodName: null,
    dishName: null,
    aiGroupId: null,
    aiGroupDescription: null,
    calories: 0,
    protein: 0,
    carb: 0,
    fat: 0,
    isEstimated: false,
    isPending: true,
  };
}

export function useCreateLogEntry(date: string) {
  const queryClient = useQueryClient();
  const key = logEntriesKey(date);
  return useMutation({
    mutationFn: (input: CreateLogEntryInput) => createLogEntry(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LogEntry[]>(key);
      const tempId = -Date.now();
      queryClient.setQueryData<LogEntry[]>(key, (old = []) => [
        ...old,
        buildPendingEntry(input, tempId),
      ]);
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// No optimistic placeholder here (unlike useCreateLogEntry) — the RPC
// itself is now a single ~1s round trip for the whole batch, so the extra
// complexity of an N-item optimistic insert isn't buying back much.
export function useCreateLogEntriesBulk(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entries,
      description,
    }: {
      entries: BulkLogEntryInput[];
      description: string | null;
    }) => createLogEntriesBulk(entries, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logEntriesKey(date) });
    },
  });
}

export function useCreateDishLogEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDishLogEntryInput) => createDishLogEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logEntriesKey(date) });
    },
  });
}

export function useUpdateLogEntry(date: string) {
  const queryClient = useQueryClient();
  const key = logEntriesKey(date);
  return useMutation({
    mutationFn: (input: UpdateLogEntryInput) => updateLogEntry(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LogEntry[]>(key);
      // Nutrient amounts scale exactly linearly with raw-equivalent grams
      // (food_nutrient is a fixed per-100g table), so re-deriving from the
      // ratio here isn't an approximation — it's the same arithmetic the
      // server will do, just done twice. yieldFactor is reused rather than
      // re-resolved because the server's own resolve_yield() call depends
      // only on food_id, which this RPC never lets an update change.
      queryClient.setQueryData<LogEntry[]>(key, (old = []) =>
        (old ?? []).map((e) => {
          if (e.id !== input.id) return e;
          const newGrams =
            input.enteredState === "cooked"
              ? input.enteredGrams / e.yieldFactor
              : input.enteredGrams;
          const ratio = e.grams > 0 ? newGrams / e.grams : 1;
          return {
            ...e,
            meal: input.meal,
            quantity: input.quantity,
            grams: newGrams,
            enteredState: input.enteredState,
            enteredGrams: input.enteredGrams,
            note: input.note ?? e.note,
            calories: e.calories * ratio,
            protein: e.protein * ratio,
            carb: e.carb * ratio,
            fat: e.fat * ratio,
          };
        }),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteLogEntry(date: string) {
  const queryClient = useQueryClient();
  const key = logEntriesKey(date);
  return useMutation({
    mutationFn: (id: number) => deleteLogEntry(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LogEntry[]>(key);
      queryClient.setQueryData<LogEntry[]>(key, (old = []) =>
        old.filter((e) => e.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
