// From mvp-build-plan.md §5, copied verbatim (types only — the resolver and
// registered providers live alongside this file).

export const NUTRIENT_KEYS = [
  "energy",
  "protein",
  "fat",
  "carb",
  "fiber",
  "fiberSoluble",
  "sugarFree",
  "starch",
  "fatSat",
  "fatMono",
  "fatPoly",
  "fatTrans",
  "omega3",
  "omega6",
  "cholesterol",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "zinc",
  "phosphorus",
  "selenium",
  "vitA",
  "vitC",
  "vitD",
  "vitE",
  "vitK",
  "folate",
  "vitB12",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type Provenance = {
  source: "ifct2017" | "off" | "fdc" | "llm" | "manual";
  confidence: "measured" | "label" | "estimated";
  sourceRef?: string;
  fetchedAt?: string;
  // Raw payload from an external provider, carried through unread by any
  // component until a confirm step persists it into food.fetch_payload.
  // Generic (not OFF-specific) so any future provider can use the same slot.
  rawPayload?: unknown;
};

export type FoodCandidate = {
  id?: string; // set if already in local catalog
  name: string;
  foodGroup?: string;
  nutrients: Partial<Record<NutrientKey, number>>; // per 100 g, canonical units
  portions: { label: string; grams: number }[];
  provenance: Provenance;
  needsConfirmation: boolean; // true for anything not from local catalog
};

export type FoodQuery = {
  text: string;
};

export interface FoodProvider {
  readonly id: Provenance["source"];
  readonly priority: number; // lower runs first
  canHandle(q: FoodQuery): boolean;
  search(q: FoodQuery, signal: AbortSignal): Promise<FoodCandidate[]>;
}
