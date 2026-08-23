// Cached shapes stored in Dexie/IndexedDB — camelCase, per project convention.
export interface CachedNutrient {
  id: number;
  key: string;
  displayName: string;
  unit: string;
  category: string;
  sortOrder: number;
}

export interface CachedFood {
  id: number;
  source: string;
  sourceRef: string | null;
  name: string;
  sourceName: string | null;
  scientificName: string | null;
  foodGroup: string | null;
  state: string;
  b12Unknown: boolean;
  isCurated: boolean;
  tags: string | null;
  nRegions: number | null;
  energySource: string;
}

export interface CachedFoodAlias {
  id?: number;
  foodId: number;
  alias: string;
}

export interface CachedFoodNutrient {
  id?: number;
  foodId: number;
  nutrientId: number;
  amount: number;
}

export interface CachedFoodPortion {
  id: number;
  foodId: number;
  label: string;
  grams: number;
  isDefault: boolean;
  isCalibrated: boolean;
}

// Raw row shapes exactly matching the Postgres/PostgREST response
// (snake_case, native types) — the boundary both the live Supabase sync and
// the offline test fixtures map through, so the mapping logic below is
// exercised identically by both.
export interface RawNutrientRow {
  id: number;
  key: string;
  display_name: string;
  unit: string;
  category: string;
  sort_order: number;
}

export interface RawFoodRow {
  id: number;
  source: string;
  source_ref: string | null;
  name: string;
  source_name: string | null;
  scientific_name: string | null;
  food_group: string | null;
  state: string;
  b12_unknown: boolean;
  is_curated: boolean;
  tags: string | null;
  n_regions: number | null;
  energy_source: string;
}

export interface RawFoodAliasRow {
  food_id: number;
  alias: string;
}

export interface RawFoodNutrientRow {
  food_id: number;
  nutrient_id: number;
  amount: number;
}

export interface RawFoodPortionRow {
  id: number;
  food_id: number;
  label: string;
  grams: number;
  is_default: boolean;
  is_calibrated: boolean;
}

export function mapNutrient(r: RawNutrientRow): CachedNutrient {
  return {
    id: r.id,
    key: r.key,
    displayName: r.display_name,
    unit: r.unit,
    category: r.category,
    sortOrder: r.sort_order,
  };
}

export function mapFood(r: RawFoodRow): CachedFood {
  return {
    id: r.id,
    source: r.source,
    sourceRef: r.source_ref,
    name: r.name,
    sourceName: r.source_name,
    scientificName: r.scientific_name,
    foodGroup: r.food_group,
    state: r.state,
    b12Unknown: r.b12_unknown,
    isCurated: r.is_curated,
    tags: r.tags,
    nRegions: r.n_regions,
    energySource: r.energy_source,
  };
}

export function mapFoodAlias(r: RawFoodAliasRow): CachedFoodAlias {
  return { foodId: r.food_id, alias: r.alias };
}

export function mapFoodNutrient(r: RawFoodNutrientRow): CachedFoodNutrient {
  return { foodId: r.food_id, nutrientId: r.nutrient_id, amount: r.amount };
}

export function mapFoodPortion(r: RawFoodPortionRow): CachedFoodPortion {
  return {
    id: r.id,
    foodId: r.food_id,
    label: r.label,
    grams: r.grams,
    isDefault: r.is_default,
    isCalibrated: r.is_calibrated,
  };
}
