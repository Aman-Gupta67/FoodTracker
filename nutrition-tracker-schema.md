# Personal Nutrition Tracker — Data Model & Import Spec

**Status:** Draft v1
**Stack:** Next.js on Vercel (free), Supabase Postgres (free tier), static catalog assets
**Canonical units:** kcal for energy, g / mg / µg for nutrients, all per 100 g edible portion
**Scope decision:** normalized nutrient list, aggregate columns dropped

---

## 1. Design decisions and rationale

### 1.1 Physical layout: fully relational, not JSONB

Earlier sizing assumed all 421 IFCT columns. Cutting to a 30-nutrient set changes the arithmetic entirely:

| Layer | Foods | Nutrients each | Rows | Est. size w/ indexes |
|---|---|---|---|---|
| IFCT 2017 | 542 | ≤30 | ~16 k | < 2 MB |
| FDC Foundation + SR Legacy | ~8,100 | ≤30 | ~240 k | ~25 MB |
| Open Food Facts (India, filtered) | ~5,000 | ~12 | ~60 k | ~8 MB |
| **Total catalog** | **~13.6 k** | | **~316 k** | **~35 MB** |

35 MB against a 500 MB budget. The JSONB optimization is unnecessary — use a normalized `food_nutrient` table and keep the ability to query across nutrients ("which foods am I getting iron from?"), which is the whole point of tracking micros.

### 1.2 Log entries snapshot their nutrient values

`log_entry` stores computed totals at write time, not a live join through `my_dish_ingredient`. If you tweak your rajma recipe in November, October's history must not silently change. This is an append-only ledger, not a view.

### 1.3 Portions are a first-class table, not a text field

The dominant error term is quantity estimation, not table accuracy. "1 katori", "1 roti", "1 glass" need stored gram equivalents that you calibrate once against a kitchen scale. Without this the app is unusable in practice, no matter how good the nutrient data is.

### 1.4 Aliases are a first-class table

FDC gives you ten rows for kidney beans and zero for "rajma". Curation happens once at import into `food_alias`, so search never hits raw source names.

---

## 2. Nutrient dictionary

30 nutrients. Everything else from IFCT/FDC is discarded at import.

| # | `key` | Display | Unit | Category |
|---|---|---|---|---|
| 1 | `energy` | Energy | kcal | macro |
| 2 | `protein` | Protein | g | macro |
| 3 | `fat` | Total Fat | g | macro |
| 4 | `carb` | Carbohydrate | g | macro |
| 5 | `fiber` | Dietary Fibre | g | macro |
| 6 | `fiberSoluble` | Soluble Fibre | g | macro |
| 7 | `sugarFree` | Free Sugars | g | macro |
| 8 | `starch` | Starch | g | macro |
| 9 | `fatSat` | Saturated Fat | g | lipid |
| 10 | `fatMono` | Monounsaturated Fat | g | lipid |
| 11 | `fatPoly` | Polyunsaturated Fat | g | lipid |
| 12 | `fatTrans` | Trans Fat | g | lipid |
| 13 | `omega3` | Omega-3 (ALA + EPA + DHA) | mg | lipid |
| 14 | `omega6` | Omega-6 | mg | lipid |
| 15 | `cholesterol` | Cholesterol | mg | lipid |
| 16 | `sodium` | Sodium | mg | mineral |
| 17 | `potassium` | Potassium | mg | mineral |
| 18 | `calcium` | Calcium | mg | mineral |
| 19 | `iron` | Iron | mg | mineral |
| 20 | `magnesium` | Magnesium | mg | mineral |
| 21 | `zinc` | Zinc | mg | mineral |
| 22 | `phosphorus` | Phosphorus | mg | mineral |
| 23 | `selenium` | Selenium | µg | mineral |
| 24 | `vitA` | Vitamin A (RAE) | µg | vitamin |
| 25 | `vitC` | Vitamin C | mg | vitamin |
| 26 | `vitD` | Vitamin D | µg | vitamin |
| 27 | `vitE` | Vitamin E (α-tocopherol) | mg | vitamin |
| 28 | `vitK` | Vitamin K | µg | vitamin |
| 29 | `folate` | Folate (B9) | µg | vitamin |
| 30 | `vitB12` | Vitamin B12 | µg | vitamin |

**Deliberately excluded:** all IFCT aggregate roll-ups (`vit`, `amiac`, `cartoid`, `mnrleq`, `mnrlet`, `mnrlpet`, `mnrlnet`, `mnrltx`, `vitb`, `polyph`, `phystr`, `tocph`, `toctr`, `orgac`), the 18 individual amino acids, the 29 individual fatty acids beyond the class totals, the ~40 polyphenols, oxalates, phytates, saponins, toxic minerals, and B1/B2/B3/B5/B7/B6 individually. Add B-complex members back later if you find a reason; they're cheap to append.

---

## 3. Source import mapping

### 3.1 IFCT 2017 (`@ifct2017/compositions`, `index.csv`, 542 rows)

**Verified:** every source value is grams per 100 g edible portion, except energy which is **kJ**. Confirmed against `B020 Rajmah, red` — `ca=0.126` → 126 mg, `fe=0.00613` → 6.13 mg, `k=1.324` → 1324 mg, `folsum=0.000316` → 316 µg. All plausible.

| Nutrient | IFCT column | Conversion |
|---|---|---|
| `energy` | `enerc` | `÷ 4.184` (kJ → kcal) |
| `protein` | `protcnt` | ×1 |
| `fat` | `fatce` | ×1 |
| `carb` | `choavldf` | ×1 |
| `fiber` | `fibtg` | ×1 |
| `fiberSoluble` | `fibsol` | ×1 |
| `sugarFree` | `fsugar` | ×1 |
| `starch` | `starch` | ×1 |
| `fatSat` | `fasat` | ×1 |
| `fatMono` | `fams` | ×1 |
| `fatPoly` | `fapu` | ×1 |
| `fatTrans` | `fatrn` | ×1 |
| `omega3` | `f18d3n3 + f20d5n3 + f22d6n3` | ×1000 |
| `omega6` | `facn6` | ×1000 |
| `cholesterol` | `cholc` | ×1000 |
| `sodium` | `na` | ×1000 |
| `potassium` | `k` | ×1000 |
| `calcium` | `ca` | ×1000 |
| `iron` | `fe` | ×1000 |
| `magnesium` | `mg` | ×1000 |
| `zinc` | `zn` | ×1000 |
| `phosphorus` | `p` | ×1000 |
| `selenium` | `se` | ×1 000 000 |
| `vitA` | `cartbeq ÷ 12 + retol × 1e6` | see note |
| `vitC` | `vitc` | ×1000 |
| `vitD` | `ergcal + chocal` | ×1 000 000 |
| `vitE` | `tocpha` | ×1000 |
| `vitK` | `vitk1 + vitk2` | ×1 000 000 |
| `folate` | `folsum` | ×1 000 000 |
| `vitB12` | **absent** | — |

**Note on `vitA`:** IFCT gives β-carotene equivalents and retinol separately. RAE = retinol µg + (β-carotene eq. µg ÷ 12). Compute, don't use the `vita` aggregate column.

**Gap — B12:** IFCT 2017 has no cobalamin column at all. It has cobalt (`co`), which is not a substitute. For a vegetarian-leaning diet B12 is one of the nutrients you most want to watch, so B12 must come from FDC or from label entry. Flag any IFCT-sourced food as `b12_unknown` rather than storing zero — storing 0 will make your dashboard confidently wrong.

**Error columns:** every nutrient has a paired `*_e` column (standard error across regions). Drop at import, but consider keeping for `energy` and `protein` if you ever want to display confidence.

### 3.2 USDA FoodData Central

Import **Foundation Foods** and **SR Legacy** only. Skip Branded (2 M rows, covered better by Open Food Facts), skip Survey/FNDDS initially (US dish-centric, low value for you).

FDC values are already per 100 g in mg/µg — no unit conversion, just nutrient ID mapping.

| Nutrient | FDC `nutrient_id` |
|---|---|
| `energy` | 1008 |
| `protein` | 1003 |
| `fat` | 1004 |
| `carb` | 1005 |
| `fiber` | 1079 |
| `sugarFree` | 2000 (total sugars — approximation) |
| `starch` | 1009 |
| `fatSat` | 1258 |
| `fatMono` | 1292 |
| `fatPoly` | 1293 |
| `fatTrans` | 1257 |
| `cholesterol` | 1253 |
| `sodium` | 1093 |
| `potassium` | 1092 |
| `calcium` | 1087 |
| `iron` | 1089 |
| `magnesium` | 1090 |
| `zinc` | 1095 |
| `phosphorus` | 1091 |
| `selenium` | 1103 |
| `vitA` | 1106 (RAE) |
| `vitC` | 1162 |
| `vitD` | 1114 |
| `vitE` | 1109 |
| `vitK` | 1185 |
| `folate` | 1177 |
| `vitB12` | 1178 |
| `omega3` | 1404 + EPA + DHA |

> **Verify before relying on this table.** Confirm every ID against `nutrient.csv` in the FDC bulk download. The EPA/DHA/omega-3 IDs in particular vary by dataset release and I have not verified them against the current file. `sugarFree` has no exact FDC equivalent — total sugars includes intrinsic sugars from fruit and milk, so IFCT-sourced and FDC-sourced sugar figures are not directly comparable.

### 3.3 Open Food Facts (India subset)

Filter the dump by `countries_tags` containing `en:india`. Macros only — labels carry no micronutrients. Populate `energy`, `protein`, `fat`, `carb`, `fiber`, `sugarFree`, `fatSat`, `sodium` and leave the rest NULL. Never zero.

### 3.4 Precedence

When a food exists in multiple sources, `IFCT > FDC > OFF` for Indian raw ingredients, and `OFF > *` for barcoded packaged goods. Store `source` on every food row so you can always explain where a number came from.

---

## 4. Schema

### 4.1 Catalog (read-mostly, seeded by import)

```sql
create type food_source as enum ('ifct2017', 'fdc', 'off', 'label', 'user');
create type food_state  as enum ('raw', 'cooked', 'prepared', 'packaged');
create type nutrient_unit as enum ('kcal', 'g', 'mg', 'ug');
create type nutrient_category as enum ('macro', 'lipid', 'mineral', 'vitamin');

create table nutrient (
  id            smallint primary key,
  key           text not null unique,          -- 'iron'
  display_name  text not null,
  unit          nutrient_unit not null,
  category      nutrient_category not null,
  sort_order    smallint not null
);

create table food (
  id              bigserial primary key,
  source          food_source not null,
  source_ref      text,                        -- 'B020' | fdc_id | barcode
  name            text not null,               -- curated: 'Rajma, red (raw)'
  source_name     text,                        -- original: 'Rajmah, red'
  scientific_name text,
  food_group      text,
  state           food_state not null default 'raw',
  barcode         text,
  b12_unknown     boolean not null default false,
  is_curated      boolean not null default false,
  tags            text,                        -- 'vegetarian eggetarian ...' free veg filter
  n_regions       smallint,                    -- IFCT sample breadth, confidence proxy
  energy_source   text not null default 'measured'
                    check (energy_source in ('measured','derived_atwater')),
  -- provenance, written from day one even though MVP only ever emits ifct2017/measured
  fetched_via     text,                        -- 'ifct'|'off_api'|'fdc_api'|'llm'|'manual'
  fetch_confidence text                        -- 'measured'|'label'|'estimated'
                    check (fetch_confidence in ('measured','label','estimated')),
  fetch_payload   jsonb,
  confirmed_at    timestamptz,
  search_tsv      tsvector generated always as
                    (to_tsvector('simple', coalesce(name,''))) stored,
  created_at      timestamptz not null default now(),
  unique (source, source_ref)
);
create index food_search_idx on food using gin (search_tsv);
create index food_barcode_idx on food (barcode) where barcode is not null;

create table food_alias (
  food_id  bigint not null references food(id) on delete cascade,
  alias    text not null,                      -- 'rajma', 'razma', 'kidney beans'
  primary key (food_id, alias)
);
create index food_alias_idx on food_alias (alias);

-- amount is per 100 g edible portion, in nutrient.unit
create table food_nutrient (
  food_id     bigint   not null references food(id) on delete cascade,
  nutrient_id smallint not null references nutrient(id),
  amount      real     not null,
  primary key (food_id, nutrient_id)
);

create table food_portion (
  id          bigserial primary key,
  food_id     bigint not null references food(id) on delete cascade,
  label       text   not null,                 -- '1 katori', '1 roti', '1 tbsp'
  grams       real   not null,
  is_default  boolean not null default false,
  is_calibrated boolean not null default false -- true = you weighed it
);
create unique index food_portion_default_idx
  on food_portion (food_id) where is_default;

-- raw↔cooked mass conversion. factor = cooked_grams / raw_grams
-- seeded from out/food_yield.csv (30 food-specific + 20 group defaults)
create table food_yield (
  id            bigserial primary key,
  match_type    text not null check (match_type in ('food','group')),
  match_value   text not null,        -- food.source_ref, or food.food_group
  factor        real not null check (factor > 0),
  note          text,
  is_calibrated boolean not null default false,
  unique (match_type, match_value)
);

-- resolution order: food-specific, then group, then 1.0
create or replace function resolve_yield(p_food_id bigint) returns real
language sql stable as $$
  select coalesce(
    (select y.factor from food_yield y join food f on f.source_ref = y.match_value
      where y.match_type = 'food' and f.id = p_food_id),
    (select y.factor from food_yield y join food f on f.food_group = y.match_value
      where y.match_type = 'group' and f.id = p_food_id),
    1.0);
$$;
```

`out/food_yield.csv` carries a `food_name` column for human review only. Drop it on load:

```sql
\copy food_yield(match_type,match_value,food_name,factor,note) from ...   -- WRONG
create temp table _yield_stage (match_type text, match_value text,
                                food_name text, factor real, note text);
\copy _yield_stage from 'out/food_yield.csv' csv header
insert into food_yield (match_type, match_value, factor, note)
  select match_type, match_value, factor, note from _yield_stage;
```

### 4.2 Personal layer (mutable, RLS-scoped)

```sql
-- a composite dish you defined once: 'Rajma chawal'
create table my_dish (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id),
  name         text not null,
  servings      real not null default 1,       -- recipe yields N servings
  yield_grams  real,                           -- cooked weight, if known
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, name)
);

create table my_dish_ingredient (
  id         bigserial primary key,
  dish_id    bigint not null references my_dish(id) on delete cascade,
  food_id    bigint not null references food(id),
  grams      real   not null,                  -- raw weight as added
  sort_order smallint not null default 0
);

create type log_ref as enum ('food', 'dish');
create type meal_slot as enum
  ('breakfast','morning_snack','lunch','evening_snack','dinner');

-- One row per "Describe what you ate" bulk-log action — lets the Home
-- screen collapse every log_entry it produced into a single card (name =
-- the description text, trimmed) instead of showing each ingredient as its
-- own row. Never created for manual single-item logging.
create table ai_meal_group (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  description text not null,
  created_at  timestamptz not null default now()
);

create table log_entry (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id),
  consumed_at   timestamptz not null,
  consumed_date date not null,                 -- local date, for daily rollups
  meal          meal_slot not null,
  ref_type      log_ref not null,
  food_id       bigint references food(id),
  dish_id       bigint references my_dish(id),
  portion_id    bigint references food_portion(id),
  quantity      real not null,                 -- multiplier on portion, or grams
  grams         real not null,                 -- RAW-EQUIVALENT grams. drives all nutrient math
  entered_state text not null default 'raw'
                  check (entered_state in ('raw','cooked')),
  entered_grams real not null,                 -- what the user actually typed
  yield_factor  real not null default 1.0,     -- snapshot of resolve_yield() at insert
  note          text,
  ai_group_id   uuid references ai_meal_group(id), -- set only by create_log_entries_bulk
  created_at    timestamptz not null default now(),
  check ((ref_type = 'food' and food_id is not null and dish_id is null)
      or (ref_type = 'dish' and dish_id is not null and food_id is null))
);
create index log_entry_user_date_idx on log_entry (user_id, consumed_date);
create index log_entry_ai_group_idx on log_entry (ai_group_id) where ai_group_id is not null;

-- snapshot: computed at insert, never recomputed
create table log_entry_nutrient (
  entry_id    bigint   not null references log_entry(id) on delete cascade,
  nutrient_id smallint not null references nutrient(id),
  amount      real     not null,
  primary key (entry_id, nutrient_id)
);

create type sex_at_birth   as enum ('male','female');
create type activity_level as enum
  ('sedentary','light','moderate','active','very_active');
create type body_goal      as enum ('lose','maintain','gain');

create table profile (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  sex               sex_at_birth not null,
  date_of_birth     date not null,
  height_cm         real not null,
  weight_kg         real not null,
  activity          activity_level not null default 'sedentary',
  goal              body_goal not null default 'maintain',
  goal_rate_kg_week real not null default 0,   -- negative for loss, clamped to ±0.75
  protein_pct       smallint not null default 30,
  carb_pct          smallint not null default 40,
  fat_pct           smallint not null default 30,
  timezone          text not null default 'Asia/Kolkata',
  updated_at        timestamptz not null default now(),
  check (protein_pct + carb_pct + fat_pct = 100),
  check (goal_rate_kg_week between -0.75 and 0.75)
);

-- derived from profile on every save, not hand-entered. see mvp-build-plan.md §4.4
create table daily_target (
  user_id     uuid     not null references auth.users(id),
  nutrient_id smallint not null references nutrient(id),
  target_min  real,
  target_max  real,
  primary key (user_id, nutrient_id)
);
```

**Two invariants that the rest of the system depends on.**

`log_entry.grams` is always raw-equivalent, because IFCT is a raw-weight table. `entered_grams` and `entered_state` exist only to render back what the user typed; never compute from them. `grams = entered_grams / yield_factor` when `entered_state = 'cooked'`, and `yield_factor` is snapshotted at insert so recalibrating `food_yield` later does not silently rewrite history.

`log_entry_nutrient` is likewise a snapshot. Editing a `my_dish` recipe must not change entries already logged from it.

### 4.3 RLS

Catalog tables (`nutrient`, `food`, `food_alias`, `food_nutrient`, `food_portion`) are read-only to `authenticated`, writable only by the service role used by the import job. Every personal table gets the standard `user_id = auth.uid()` policy on all four verbs. `log_entry_nutrient` has no `user_id`, so its policy must join through `log_entry`.

---

## 5. Resolution logic

Computing nutrients for a log entry:

**`ref_type = 'food'`** — `amount = food_nutrient.amount × grams / 100`, for every nutrient present. NULL stays absent from the snapshot; it does not become 0.

**`ref_type = 'dish'`** — sum each ingredient's contribution, divide by `servings`, multiply by the logged quantity:

```
dish_total(n)   = Σ over ingredients ( food_nutrient(food_id, n) × grams / 100 )
per_serving(n)  = dish_total(n) / servings
entry_amount(n) = per_serving(n) × quantity
```

**Coverage flag.** If any ingredient in a dish lacks a nutrient, the dish total for that nutrient is an undercount. Track `covered_grams / total_grams` per nutrient and surface it in the UI. A day showing "iron: 4 mg" where 60 % of intake had no iron data is worse than showing nothing, because it invites a false conclusion.

**Cooking losses.** Not modelled in v1. Raw-weight nutrients applied to cooked dishes overstates water-soluble vitamins (C, folate, some B) by 20–50 %. Acceptable for v1; document it so you don't trust those two lines.

---

## 6. Storage projection

| Table | Rows (yr 1) | Est. size |
|---|---|---|
| `nutrient` | 30 | negligible |
| `food` | ~13,600 | ~6 MB with GIN index |
| `food_alias` | ~2,000 | < 1 MB |
| `food_nutrient` | ~316,000 | ~28 MB |
| `food_portion` | ~1,500 | < 1 MB |
| `my_dish` + ingredients | ~250 / ~1,200 | < 1 MB |
| `log_entry` | ~2,500 | < 1 MB |
| `log_entry_nutrient` | ~65,000 | ~6 MB |
| **Total** | | **~45 MB** |

Comfortably inside the 500 MB free tier, with room for several years of logging. Growth is ~7 MB/year, entirely from log snapshots.

**Remaining free-tier risk is not storage.** Supabase pauses free projects after 7 days of inactivity and takes no automatic backups. Mitigations: a scheduled weekly `GET` to keep it warm, plus a monthly `pg_dump` of the personal tables only (the catalog is reproducible from the import script, so it never needs backing up).

---

## 7. Build order

1. Seed `nutrient` (30 rows, hand-written, single migration).
2. Write the IFCT importer — 542 rows, all conversions verified above. Ends with a working catalog of Indian raw ingredients.
3. Build logging end-to-end against IFCT only. Prove the loop works before adding data.
4. Calibrate `food_portion` for your 30 most-eaten foods with a kitchen scale. Highest accuracy-per-hour of any task on this list.
5. Add the FDC importer (Foundation + SR Legacy), curating aliases as you hit gaps like oats.
6. Add Open Food Facts barcode lookup for packaged goods.
7. Optional: LLM meal decomposition into `my_dish_ingredient` drafts.

Stop after step 4 and reassess. It's plausible that ~100 curated foods plus calibrated portions covers 90 % of your intake and steps 5–7 are never worth building.

---

## 8. Open questions

1. **`sugarFree` vs total sugars** — IFCT free sugars and FDC total sugars are different quantities. Keep as one nutrient with a source caveat, or split into two?
2. **Cooked-state entries** — model separate `food` rows for cooked variants, or apply yield/retention factors at resolution time? Second is more correct, much more work.
3. **Recipe versioning** — snapshots protect history, but you lose the ability to see how a dish's composition changed. Add `my_dish_version` or accept?
4. **B12** — accept the IFCT gap, or hand-curate B12 for the ~40 IFCT foods where it matters (dairy, eggs, fish, meat) from FDC equivalents?
