import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { syncCatalogIfStale } from "@/lib/catalog/sync";

async function addFoodAliases(input: {
  foodId: number;
  aliases: string[];
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_food_aliases", {
    p_food_id: input.foodId,
    p_aliases: input.aliases,
  });
  if (error) throw error;

  await syncCatalogIfStale();
}

// Only ever called with aliases a human has explicitly approved — the LLM
// suggests, it never writes directly.
export function useAddFoodAliases() {
  return useMutation({
    mutationFn: (input: { foodId: number; aliases: string[] }) =>
      addFoodAliases(input),
  });
}
