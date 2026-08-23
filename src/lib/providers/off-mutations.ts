import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { syncCatalogIfStale } from "@/lib/catalog/sync";
import type { FoodCandidate, NutrientKey } from "./types";

async function confirmOffFood(candidate: FoodCandidate): Promise<FoodCandidate> {
  const { provenance } = candidate;
  const barcode = provenance.sourceRef;
  if (!barcode) throw new Error("confirmOffFood requires a barcode (provenance.sourceRef)");

  const nutrients = Object.entries(candidate.nutrients)
    .filter(([, amount]) => amount !== undefined)
    .map(([key, amount]) => ({ key: key as NutrientKey, amount }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_off_food", {
    p_barcode: barcode,
    p_name: candidate.name,
    p_source_name: candidate.name,
    p_food_group: candidate.foodGroup ?? null,
    p_fetch_confidence: provenance.confidence,
    p_fetch_payload: provenance.rawPayload ?? {},
    p_nutrients: nutrients,
  });
  if (error) throw error;

  await syncCatalogIfStale();

  return {
    ...candidate,
    id: String(data as number),
    needsConfirmation: false,
  };
}

// Persists a needsConfirmation OFF candidate into the catalog, then
// resyncs the Dexie mirror so it's immediately findable by name search.
export function useConfirmOffFood() {
  return useMutation({
    mutationFn: (candidate: FoodCandidate) => confirmOffFood(candidate),
  });
}
