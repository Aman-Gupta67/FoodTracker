import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDailyTargets,
  fetchProfile,
  fetchWeightLog,
  saveProfileAndTargets,
} from "./queries";
import type { ProfileInput } from "./types";

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
}

export function useDailyTargets() {
  return useQuery({ queryKey: ["daily-targets"], queryFn: fetchDailyTargets });
}

export function useWeightLog(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["weight-log", startDate, endDate],
    queryFn: () => fetchWeightLog(startDate, endDate),
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => saveProfileAndTargets(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["daily-targets"] });
    },
  });
}
