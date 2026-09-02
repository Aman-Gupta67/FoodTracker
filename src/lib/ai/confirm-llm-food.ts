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

// idx is caller-assigned (the item's position in the pending list) rather
// than relied on from return order — results map back by idx regardless of
// any ordering the RPC happens to return.
export interface BulkConfirmItem {
  idx: number;
  candidate: FoodCandidate;
}

async function confirmLlmFoodsBulk(
  items: BulkConfirmItem[],
): Promise<Map<number, number>> {
  if (items.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_llm_foods_bulk", {
    p_items: items.map(({ idx, candidate }) => ({
      idx,
      name: candidate.name,
      food_group: candidate.foodGroup ?? null,
      state: "prepared",
      fetch_payload: candidate.provenance.rawPayload ?? {},
      nutrients: Object.entries(candidate.nutrients)
        .filter(([, amount]) => amount !== undefined)
        .map(([key, amount]) => ({ key, amount })),
    })),
  });
  if (error) throw error;

  await syncCatalogIfStale();

  return new Map(
    (data as { idx: number; food_id: number }[]).map((r) => [r.idx, r.food_id]),
  );
}

// One round trip for every AI-estimated item in a pending list instead of
// one RPC call per item — this is what took "Log this" on a 10-ingredient
// meal from ~1 minute to ~1 second (see
// supabase/migrations/0020_ai_bulk_logging.sql). Idempotent per food (the
// underlying upsert keys on a deterministic slug of the name), so calling
// it again after a partial failure elsewhere in the flow is safe.
export function useConfirmLlmFoodsBulk() {
  return useMutation({
    mutationFn: (items: BulkConfirmItem[]) => confirmLlmFoodsBulk(items),
  });
}
