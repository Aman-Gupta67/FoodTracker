// Open Food Facts product-by-barcode lookup. OFF sends
// access-control-allow-origin: * on this endpoint (confirmed live), so it's
// safe to call directly from the browser — no proxy route needed. A generic
// user-agent gets silently soft-blocked with an HTML "temporarily
// unavailable" page instead of a rate-limit error, so a real one is required.

const OFF_FIELDS =
  "code,product_name,brands,quantity,nutriments,nutrition_data_per,countries_tags";

export type OffProduct = {
  code: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutrition_data_per?: string;
  countries_tags?: string[];
};

export async function fetchOffProduct(
  barcode: string,
  signal: AbortSignal,
): Promise<OffProduct | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`,
    { signal, headers: { "User-Agent": "FoodTracker/1.0 (personal use)" } },
  );
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 1) return null;
  return data.product as OffProduct;
}
