import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDishLogEntry,
  createLogEntry,
  deleteLogEntry,
  fetchDailyCalorieTotals,
  fetchFrequentFoods,
  fetchLastLogForFood,
  fetchLogEntriesForDate,
  fetchRecentFoods,
  updateLogEntry,
  type CreateDishLogEntryInput,
} from "./queries";
import type { CreateLogEntryInput, MealSlot, UpdateLogEntryInput } from "./types";

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

export function useCreateLogEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLogEntryInput) => createLogEntry(input),
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
  return useMutation({
    mutationFn: (input: UpdateLogEntryInput) => updateLogEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logEntriesKey(date) });
    },
  });
}

export function useDeleteLogEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteLogEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logEntriesKey(date) });
    },
  });
}
