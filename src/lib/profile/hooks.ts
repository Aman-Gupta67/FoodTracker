import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDailyTargets, fetchProfile, saveProfileAndTargets } from "./queries";
import type { ProfileInput } from "./types";

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
}

export function useDailyTargets() {
  return useQuery({ queryKey: ["daily-targets"], queryFn: fetchDailyTargets });
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
