import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

// PostgREST caps an unpaginated `select` at 1000 rows by default. food_alias
// (5,308 rows) and food_nutrient (15,718 rows) both exceed that — fetching
// without paging here would silently cache a truncated catalog.
export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
