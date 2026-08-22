# Import Pipeline & Lazy Hydration — Runbook

Covers: how each source becomes loadable rows, how to handle the 16 GB Open Food Facts dump on a Mac, and the on-demand fetch design that makes most of the bulk import optional.

---

## 1. IFCT 2017 — done, verified

`import_ifct.py` runs against `node_modules/@ifct2017/compositions/index.csv` and emits four files. Already executed; results below are real output, not projections.

```
foods            : 542
aliases          : 5308   (9.8 per food)
nutrient values  : 15718
b12 flagged      : 542    (IFCT has no cobalamin column)
```

Sanity check on `B020 Rajmah, red`, per 100 g:

| Nutrient | Value | Cross-check |
|---|---|---|
| energy | 299.2 kcal | 1252 kJ ÷ 4.184 ✓ |
| protein | 19.91 g | ✓ |
| carb | 48.61 g | ✓ |
| fibre | 16.57 g | ✓ |
| calcium | 126 mg | ✓ |
| iron | 6.13 mg | ✓ |
| potassium | 1324 mg | ✓ |
| folate | 316 µg | ✓ |
| omega-3 | 557 mg | ALA + EPA + DHA ✓ |

### 1.1 The alias extraction is the sleeper win

IFCT's `Local Name` column carries up to 18 language names per food — `A. Rajmah; B. Barbati beej; E. Rajma, Razma; H. Rajmah; Kan. Thugare bele; ...`. Parsing it yields **5,308 aliases across 3,576 distinct search terms**, free. Verified resolutions:

| Query | Resolves to |
|---|---|
| `rajma` / `razma` | Rajmah black / brown / red |
| `maida` | Wheat flour, refined |
| `atta` | Wheat flour, atta |
| `haldi` | Turmeric powder |
| `jeera` | Cumin seeds |
| `methi` | Fenugreek leaves + seeds |
| `palak` | Spinach, Basella leaves |
| `bhindi` | Ladies finger |
| `chana` | Bengal gram, whole |
| `dahi`, `paneer`, `besan`, `sooji`, `oats` | **miss — not in IFCT** |

This is why the USDA "ten results for rajma" problem disappears: you search aliases, not source names.

### 1.2 Defect found: all 14 cooking oils have zero energy

IFCT leaves `enerc` empty for every row in the **Edible Oils and Fats** group — coconut, groundnut, mustard, rice bran, sunflower, soyabean, palm, safflower, gingelly, corn, cottonseed, ghee, vanaspati — while correctly reporting `fat = 100 g`.

Left unpatched, logging 15 g of ghee in a dal tadka contributes **0 kcal**. Indian cooking puts oil in nearly everything, so this one gap would have understated daily intake by 200–400 kcal and quietly invalidated the whole tracker.

**Fix applied:** energy falls back to an Atwater reconstruction when the source value is absent.

```
kcal = 4×protein + 9×fat + 4×availableCarb + 2×fibre
```

Validated against the 528 rows that *do* carry an energy value: **median disagreement 2.62%**. All 14 oils now resolve to ~900 kcal/100 g, which is correct. `food.energy_source` records `measured` or `derived_atwater` per row.

### 1.3 36 rows flagged for manual review

The importer writes `out/warnings.csv`. Beyond the 14 oils, 36 foods disagree with Atwater by more than 25%, clustering suspiciously near a factor of exactly 2:

| Food | IFCT kcal | Atwater | Diff |
|---|---|---|---|
| Radish, elongate, red skin | 32.0 | 15.0 | 53.1% |
| Radish, round, white skin | 30.8 | 15.0 | 51.2% |
| Palm fruit, tender | 24.1 | 12.0 | 50.3% |
| Chicken, poultry, leg, skinless | 383.6 | 191.5 | 50.1% |
| Lemon, juice | 36.6 | 18.8 | 48.7% |
| Grapes, seedless, oval, black | 94.4 | 49.8 | 47.2% |

Spot-checks are inconclusive. Real radish is ~16 kcal and real lemon juice ~22 kcal, which favours Atwater. Real grapes are ~69 kcal, sitting between the two. Skinless chicken leg is ~150 kcal in every other reference, so IFCT's 384 is clearly wrong there.

**No automatic correction applied.** Flagged, not overridden — silently "fixing" measured data on a heuristic produces a database nobody can reason about. Cross-check the handful you actually eat against FDC and set them by hand with `is_curated = true`.

### 1.4 Zeros are real, mostly

Coverage reads 100% on every nutrient because IFCT writes `0` rather than blank. Checked the distribution — the zeros are overwhelmingly genuine: `carb = 0` on 229 foods maps almost exactly onto the 92 marine fish + 63 meat + 19 poultry + 15 egg + shellfish rows; `cholesterol = 0` on 331 foods is the plant kingdom; `fatTrans` non-zero on only 2. So treat IFCT zeros as measured, not missing. The one true absence is B12, which the importer deliberately does not emit and flags per-row.

### 1.5 Loading into Supabase

```bash
psql "$SUPABASE_DB_URL" -f out/seed_nutrient.sql

psql "$SUPABASE_DB_URL" <<'SQL'
\copy food(id,source,source_ref,name,source_name,scientific_name,food_group,state,b12_unknown,is_curated,tags,n_regions,energy_source) from 'out/food.csv' csv header
\copy food_alias(food_id,alias) from 'out/food_alias.csv' csv header
\copy food_nutrient(food_id,nutrient_id,amount) from 'out/food_nutrient.csv' csv header

-- food_yield.csv carries a food_name column for human review; do not load it
create temp table _yield_stage (match_type text, match_value text,
                                food_name text, factor real, note text)
  on commit drop;
\copy _yield_stage from 'out/food_yield.csv' csv header
insert into food_yield (match_type, match_value, factor, note)
  select match_type, match_value, factor, note from _yield_stage;

select setval('food_id_seq', (select max(id) from food));
SQL
```

Column order in the `\copy` list must match `out/food.csv` exactly. `tags`, `n_regions`, and `energy_source` are all in the `food` DDL in the schema doc — `tags` gives a free veg/non-veg filter, `n_regions` is a sample-breadth confidence proxy, `energy_source` distinguishes measured from Atwater-derived.

Verify after load:

```sql
select count(*) from food;         -- 542
select count(*) from food_alias;   -- 5308
select count(*) from food_nutrient;-- 15718
select count(*) from food_yield;   -- 50
select amount from food_nutrient fn join food f on f.id = fn.food_id
  where f.source_ref = 'B020' and fn.nutrient_id = 18;   -- 126 mg calcium
select count(*) from food_nutrient where nutrient_id = 30;  -- 0, B12 never emitted
```

---

## 2. USDA FDC — same shape, you run it

Not written yet because it needs the bulk download (~1 GB zipped). Structure is identical: read `food.csv` + `food_nutrient.csv` + `nutrient.csv` from the Foundation and SR Legacy zips, map `nutrient_id` through the table in the schema doc, emit the same three CSVs with IDs offset above 100000 so they don't collide with IFCT.

**Verify the nutrient IDs first.** Before writing any mapping, run this against the downloaded `nutrient.csv`:

```bash
awk -F, 'NR==1 || $1 ~ /^(1008|1003|1004|1005|1079|2000|1258|1292|1293|1257|1253|1093|1092|1087|1089|1090|1095|1091|1103|1106|1162|1114|1109|1185|1177|1178|1404)$/' nutrient.csv
```

Anything that doesn't print, or prints a name you didn't expect, is a mapping bug caught before it becomes bad data. The EPA/DHA IDs specifically I have not verified.

Import only Foundation + SR Legacy. Skip Branded.

---

## 3. Open Food Facts — never open the 16 GB file

Excel caps at 1,048,576 rows and LibreOffice will try to load the whole thing into RAM. Both will fail, and neither is the right tool. The file has ~200 columns and ~4 M rows.

**Use DuckDB.** Single binary, no server, reads files larger than RAM by streaming, speaks SQL directly against CSV. Free.

```bash
brew install duckdb
```

The OFF full export is tab-separated with embedded quotes and newlines, so force the dialect explicitly:

```sql
-- inspect first, don't guess at column names
DESCRIBE SELECT * FROM read_csv(
  'en.openfoodfacts.org.products.csv',
  delim='\t', header=true, quote='', escape='',
  ignore_errors=true, sample_size=-1
);
```

Then filter to India and the ~15 columns you care about, writing a small Parquet you can actually work with:

```sql
COPY (
  SELECT
    code                                   AS barcode,
    product_name,
    brands,
    quantity,
    serving_size,
    "energy-kcal_100g"                     AS energy,
    proteins_100g                          AS protein,
    fat_100g                               AS fat,
    carbohydrates_100g                     AS carb,
    fiber_100g                             AS fiber,
    sugars_100g                            AS sugar_total,
    "saturated-fat_100g"                   AS fat_sat,
    sodium_100g * 1000                     AS sodium_mg,
    countries_tags
  FROM read_csv('en.openfoodfacts.org.products.csv',
                delim='\t', header=true, quote='', escape='',
                ignore_errors=true, sample_size=-1)
  WHERE countries_tags LIKE '%en:india%'
    AND product_name IS NOT NULL
    AND "energy-kcal_100g" IS NOT NULL
) TO 'off_india.parquet' (FORMAT parquet);
```

Expect that to land somewhere in the tens of MB and run in a few minutes on an M-series Mac. From there:

```sql
SELECT count(*) FROM 'off_india.parquet';
SELECT * FROM 'off_india.parquet' WHERE product_name ILIKE '%oats%' LIMIT 20;
```

Two things to know before you trust it. OFF is crowd-sourced, so nutrition values are frequently wrong or in the wrong units — sanity-filter anything with `energy > 900` kcal/100 g (physically impossible; pure fat is ~900) or macros summing past 100 g. And labels carry no micronutrients, so every OFF row imports with 24 of your 30 nutrients NULL.

**Also check whether you need the full dump at all.** OFF publishes country extracts and a Parquet mirror on Hugging Face; if an India-only file exists you skip the 16 GB download entirely. Worth five minutes on their data page before committing to the big file.

---

## 4. Lazy hydration — the answer to your third question, and it changes the plan

Yes, and this should probably be the primary acquisition path rather than a fallback.

If your real universe is 200–300 foods, bulk-importing 13,600 to use 2% of them is backwards. Seed the 542 IFCT rows because they're tiny and authoritative, then let the app fetch on demand.

### 4.1 Resolution cascade

On food entry, walk the ladder and stop at the first hit:

1. **Local alias exact match** — instant, covers everything you've eaten before. This will be the answer >90% of the time within a month of use.
2. **Local full-text search** on `food.name` + `food_alias.alias`.
3. **Barcode scan → Open Food Facts API** — `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Free, no key, no bulk download needed. This alone may eliminate section 3 entirely.
4. **FDC search API** — free with a key, covers whole foods IFCT lacks (oats, quinoa varieties, imported produce).
5. **LLM + web search** — last resort for restaurant items and regional dishes. Returns a proposed ingredient decomposition, not a nutrient blob.

### 4.2 The rule that keeps your data clean

**Nothing enters the catalog without confirmation.** Steps 3–5 produce a *draft* the app shows you for review; you accept, correct, or reject. On accept it writes to `food` with real provenance and `is_curated = true`.

This is precisely where MyFitnessPal failed. Their catalog is unverified user submissions promoted straight to canonical, which is why "Roti — 80 cal" coexists with "Roti — 297 cal". Your version has one user, so a two-second confirmation tap gives you a database you can actually trust for years.

### 4.3 Provenance columns

Extend `food` from the schema doc:

```sql
alter table food add column fetched_via text;        -- 'ifct'|'off_api'|'fdc_api'|'llm'|'manual'
alter table food add column fetch_confidence text;   -- 'measured'|'label'|'estimated'
alter table food add column fetch_payload jsonb;     -- raw response, for re-derivation
alter table food add column confirmed_at timestamptz;
```

`fetch_confidence` matters more than it looks. An LLM-estimated "Chole bhature — 450 kcal" and a measured IFCT value should not render identically in the UI. Show estimated values in a different weight, and let a weekly summary tell you what fraction of your intake was estimated versus measured. If that number is 60%, your calorie total is decoration.

### 4.4 What LLM step 5 should actually return

Ingredients and grams, never a nutrient blob:

```json
{
  "dishName": "Rajma chawal",
  "servings": 1,
  "confidence": "estimated",
  "ingredients": [
    { "query": "rajma", "grams": 60, "note": "dry weight" },
    { "query": "rice, raw milled",  "grams": 80 },
    { "query": "onion",  "grams": 40 },
    { "query": "tomato", "grams": 40 },
    { "query": "mustard oil", "grams": 12 },
    { "query": "cumin seeds", "grams": 2 }
  ]
}
```

Each `query` resolves through the same alias index, so nutrients come from IFCT with full provenance and the LLM is only ever guessing at *quantities* — which is the thing it's least bad at and the thing you'd be guessing at anyway. It never invents a nutrient number.

Gemini and Groq both have free tiers sufficient for a few hundred calls a month.

### 4.5 Revised build order

1. Seed nutrient dictionary + IFCT. **← output already generated**
2. Alias search + logging loop end-to-end.
3. Calibrate portions for your top 30 foods with a kitchen scale.
4. OFF barcode API on cache-miss (step 3 of the cascade).
5. FDC search API on cache-miss.
6. LLM dish decomposition.

Sections 2 and 3 of this document — the bulk FDC and OFF imports — move to optional. Only build them if the on-demand path proves too slow or you want offline search over foods you've never eaten.

---

## 5. Open items

1. Verify FDC nutrient IDs against the real `nutrient.csv` before writing that importer.
2. Check for an OFF India extract before downloading 16 GB again.
3. Decide whether `tags` (veg/non-veg) and `n_regions` (sample confidence) go into the `food` table — both are free from IFCT and already parsed.
4. B12 backfill: hand-curate for the ~40 IFCT dairy/egg/fish/meat rows, or leave flagged.
