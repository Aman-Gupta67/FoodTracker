import { createClient } from "@/lib/supabase/client";

// Thin wrapper around the resolve_yield() SQL function — CLAUDE.md invariant
// #6: yield resolution lives in exactly one place, never reimplemented here.
export async function resolveYield(foodId: number): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("resolve_yield", {
    p_food_id: foodId,
  });
  if (error) throw error;
  return data as number;
}
