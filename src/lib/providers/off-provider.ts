import { fetchOffProduct, type OffProduct } from "./off-client";
import type { FoodCandidate, FoodProvider, FoodQuery, NutrientKey } from "./types";

// nutrition-tracker-schema.md §3.3: OFF is macros-only — populate exactly
// these keys, leave everything else NULL. Never invent a zero for a field
// OFF didn't report.
const NUTRIENT_FIELD_MAP: [NutrientKey, string][] = [
  ["energy", "energy-kcal_100g"],
  ["protein", "proteins_100g"],
  ["fat", "fat_100g"],
  ["carb", "carbohydrates_100g"],
  ["fiber", "fiber_100g"],
  ["sugarFree", "sugars_100g"], // total sugars — approximation, same caveat as the FDC mapping
  ["fatSat", "saturated-fat_100g"],
];

const BARCODE_PATTERN = /^\d{8,14}$/;

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapNutrients(nutriments: OffProduct["nutriments"]): Partial<Record<NutrientKey, number>> {
  const nutrients: Partial<Record<NutrientKey, number>> = {};
  if (!nutriments) return nutrients;

  for (const [key, field] of NUTRIENT_FIELD_MAP) {
    const amount = toNumber(nutriments[field]);
    if (amount !== undefined) nutrients[key] = amount;
  }

  // sodium: OFF reports sodium/salt in grams; nutrient.unit for sodium is mg.
  // Prefer sodium_100g directly; fall back to deriving from salt_100g.
  const sodiumG = toNumber(nutriments["sodium_100g"]);
  const saltG = toNumber(nutriments["salt_100g"]);
  const sodiumFromSalt = saltG !== undefined ? saltG / 2.5 : undefined;
  const resolvedSodiumG = sodiumG ?? sodiumFromSalt;
  if (resolvedSodiumG !== undefined) nutrients.sodium = resolvedSodiumG * 1000;

  return nutrients;
}

function mapPortions(product: OffProduct): { label: string; grams: number }[] {
  const match = product.quantity?.match(/([\d.]+)\s*g\b/i);
  if (!match) return [];
  const grams = Number(match[1]);
  if (!Number.isFinite(grams) || grams <= 0) return [];
  return [{ label: `1 pack (${product.quantity})`, grams }];
}

export function mapOffProductToCandidate(
  product: OffProduct,
  barcode: string,
): FoodCandidate | null {
  const nutrients = mapNutrients(product.nutriments);
  // No energy figure means nothing nutritionally useful to show or save.
  if (nutrients.energy === undefined) return null;

  const name = product.product_name?.trim() || product.brands?.trim() || barcode;

  return {
    name,
    nutrients,
    portions: mapPortions(product),
    provenance: {
      source: "off",
      confidence: "label",
      sourceRef: barcode,
      fetchedAt: new Date().toISOString(),
      rawPayload: product,
    },
    needsConfirmation: true,
  };
}

// Registered alongside LocalCatalogProvider in resolve.ts. Only handles
// barcode-shaped queries — resolveFoodCandidates already stops at the first
// provider that returns a non-empty result, and LocalCatalogProvider returns
// [] for a 13-digit numeric query, so this only ever runs as the fallback.
export class OffProvider implements FoodProvider {
  readonly id = "off" as const;
  readonly priority = 10;

  canHandle(q: FoodQuery): boolean {
    return BARCODE_PATTERN.test(q.text.trim());
  }

  async search(q: FoodQuery, signal: AbortSignal): Promise<FoodCandidate[]> {
    const barcode = q.text.trim();
    const product = await fetchOffProduct(barcode, signal);
    if (!product) return [];

    const candidate = mapOffProductToCandidate(product, barcode);
    return candidate ? [candidate] : [];
  }
}
