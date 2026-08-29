import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { syncCatalogIfStale } from "@/lib/catalog/sync";
import type { FoodCandidate } from "@/lib/providers/types";

async function confirmLlmFood(candidate: FoodCandidate): Promise<number> {
  const nutrients = Object.entries(candidate.nutrients)
    .filter(([, amount]) => amount !== undefined)
    .map(([key, amount]) => ({ key, amount }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_llm_food", {
    p_name: candidate.name,
    p_food_group: candidate.foodGroup ?? null,
    p_state: "prepared",
    p_fetch_payload: candidate.provenance.rawPayload ?? {},
    p_nutrients: nutrients,
  });
  if (error) throw error;

  await syncCatalogIfStale();

  return data as number;
}

// Persists a needsConfirmation LLM candidate into the catalog, then resyncs
// the Dexie mirror so it's immediately findable and reusable next time —
// the LLM only ever has to be asked once per genuinely new food.
export function useConfirmLlmFood() {
  return useMutation({
    mutationFn: (candidate: FoodCandidate) => confirmLlmFood(candidate),
  });
}
