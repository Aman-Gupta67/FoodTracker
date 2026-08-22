# Food Tracker MVP — Build Plan & Engineering Handoff

**Status:** Ready for development
**Audience:** Claude Code
**Prereqs in repo:** `nutrition-tracker-schema.md`, `pipeline-runbook.md`, `import_ifct.py`, `out/*.csv`

---

## 1. What we are building

A single-user PWA for logging food and tracking calories and macros against a computed target, seeded from IFCT 2017.

**The success criterion is not feature completeness. It is speed.**

> Logging a repeat meal must take **under 10 seconds and no more than 3 taps**.

Trackers don't fail from missing features. They fail on day nine when logging costs 45 seconds and the user stops. Every scope call below is subordinate to that number. If a feature makes the repeat-logging path slower, it loses.

### 1.1 In scope

| Area | MVP |
|---|---|
| Catalog | IFCT 2017 only — 542 foods, 5,308 aliases, 15,718 nutrient values across 29 of 30 dictionary nutrients (B12 absent from source) |
| Search | Alias-first, recents and frequents surfaced before the search box |
| Logging | 5 meal slots, quantity by portion preset or grams, raw/cooked toggle |
| Meals | Log items → "save these as a meal" → reusable, persisted |
| Targets | Mifflin-St Jeor → calorie target + protein/carb/fat split |
| Views | Today (doubles as dashboard), Add food, Food detail, My meals, Profile, History |
| Offline | Catalog cached in IndexedDB; reads work offline, writes require network |
| Auth | Supabase magic link, RLS enforced, multi-user ready |

### 1.2 Out of scope, deliberately

Open Food Facts, FDC, LLM decomposition, barcode scanning, photo logging, water tracking, exercise, weight logging, micronutrient dashboards, social anything, notifications, dark mode.

Micronutrients are **stored and viewable on the food detail screen** but get no dashboard. The data is there; the UI for it isn't worth building until the logging habit sticks.

### 1.3 Explicitly cut, with reasoning

**Separate dashboard screen.** At one user, the Today view *is* the dashboard. Two screens showing the same numbers is two screens to maintain. History gets a 7-day bar strip and nothing more — weekly trends are meaningless until three weeks of data exist.

**Recipe builder screen.** Retroactive save instead: log the four items, tap "save as meal," name it. Same object, half the UI, and it matches how you actually discover that a combination is repeatable.

---

## 2. Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | |
| Styling | Tailwind CSS + shadcn/ui | |
| Server state | TanStack Query | |
| Local cache | Dexie (IndexedDB) | catalog only |
| PWA | Serwist (`@serwist/next`) | next-pwa is unmaintained |
| DB / Auth | Supabase free tier | Postgres + magic link + RLS |
| Hosting | Vercel free tier | |
| Charts | Hand-rolled SVG rings and bars | no chart lib for MVP |

Keep the dependency list short. Every package is a thing that breaks on a Next.js major.

---

## 3. Design system

### 3.1 Colour

Primary `#fc8c2f`.

| Token | Hex | Use |
|---|---|---|
| `primary-50` | `#fdf5ec` | tinted surfaces |
| `primary-100` | `#feebda` | selected row background |
| `primary-200` | `#fdd7b5` | borders on tinted surfaces |
| `primary-300` | `#fdb77e` | progress track fill |
| `primary-400` | `#fc9e56` | hover on primary |
| `primary-500` | `#fc8c2f` | **brand**, buttons, calorie ring |
| `primary-600` | `#de761e` | button pressed |
| `primary-700` | `#ba6216` | text on white |
| `primary-800` | `#8f4b11` | text on primary-100 |

**Accessibility constraint:** `#fc8c2f` on white is roughly 2.2:1 and fails WCAG AA for text. Use it for fills and never for body text on white. Orange text on white must be `primary-700` or darker. White text on orange needs `primary-600` or darker as the background.

Neutrals: Tailwind `stone` — warmer than slate, sits better with orange.

Macro colours must not collide with the brand orange:

| Macro | Hex |
|---|---|
| Protein | `#2563eb` |
| Carbs | `#0d9488` |
| Fat | `#7c3aed` |
| Calories | `primary-500` |

### 3.2 Layout

Mobile-first, single column, max width 480px centred on desktop. Bottom tab bar with four items: Today, Add, Meals, Profile. Add is a centre FAB-style button.

Type scale 14/16/20/28. Two weights, 400 and 500. Sentence case everywhere.

---

## 4. Schema

**`nutrition-tracker-schema.md` §4 is the single source of truth for DDL and has been updated to include everything below.** Write migrations from that file, not from this one. This section explains the *why* behind the parts that are not self-evident.

### 4.1 Meal slots

Five named slots, no `other`:

```sql
create type meal_slot as enum
  ('breakfast', 'morning_snack', 'lunch', 'evening_snack', 'dinner');
```

An `other` bucket sounds harmless and turns into the place everything goes when the UI is slow. Force the choice; five taps' worth of options is not a burden.

### 4.2 Yield factors

`out/food_yield.csv` ships 50 rows: 30 food-specific overrides plus a default for all 20 IFCT food groups. Factor is `cooked_grams / raw_grams`, so `raw_g = cooked_g / factor`.

DDL and the `resolve_yield()` function live in the schema doc. Resolution order is food-specific match, then group match, then `1.0`, and it lives in **one SQL function** so application code cannot drift from it. Note the CSV carries a `food_name` column for human review that must not be loaded into the table.

Sample resolutions: 100 g cooked rice → 37.0 g raw; 100 g cooked rajma → 41.7 g raw; 100 g roti → 71.4 g atta; 100 g cooked spinach → 166.7 g raw.

**These factors are approximations, not measurements.** They are seeded with `is_calibrated = false`. Displaying them as precise is dishonest — the UI must show a subtle "estimated" marker on any entry that went through a yield conversion. Calibrate the ones you use most by weighing raw and cooked once.

**Nutrient retention is not modelled.** Mass yield only. Water-soluble vitamins (C, folate, some B) are overstated by 20–50% on boiled foods. Acceptable for MVP because the macro numbers — the ones driving the whole product — are unaffected. Document it in the UI where micros are shown.

### 4.3 Log entry — raw/cooked

`log_entry` gains `entered_state`, `entered_grams`, and `yield_factor`, and the meaning of the existing `grams` column narrows to **raw-equivalent grams**:

```
grams = entered_state = 'cooked' ? entered_grams / yield_factor : entered_grams
```

The invariant: nutrients are always computed from `grams`, because IFCT is a raw-weight table. `entered_*` exists only to render back what the user typed. `yield_factor` is snapshotted at insert — recalibrating `food_yield` next month must not silently rewrite last month's calories.

(`food_state` already includes `'cooked'` in the schema doc. No enum alteration needed.)

### 4.4 Profile and targets

New `profile` table, DDL in the schema doc. `daily_target` stays but is now **derived** rather than hand-entered. Compute on profile save and upsert:

```
BMR (Mifflin-St Jeor)
  male   : 10×kg + 6.25×cm − 5×age + 5
  female : 10×kg + 6.25×cm − 5×age − 161

TDEE = BMR × activityFactor
  sedentary 1.2 | light 1.375 | moderate 1.55 | active 1.725 | very_active 1.9

calorieTarget = TDEE + (goalRateKgWeek × 7700 / 7)

proteinG = calorieTarget × proteinPct / 100 / 4
carbG    = calorieTarget × carbPct    / 100 / 4
fatG     = calorieTarget × fatPct     / 100 / 9
```

**Guardrail — required, not optional.** Clamp `calorieTarget` to a floor of `max(1200, BMR × 0.85)` and cap `goalRateKgWeek` at ±0.75. If a profile would produce a target below the floor, show the floor and say why. An app that will happily hand you an 800 kcal target is an app that can hurt you, and the cost of the guardrail is four lines.

### 4.5 Saved meals persist — confirmed

`my_dish` and `my_dish_ingredient` from the schema doc, unchanged. "Save as meal" writes both; the Meals tab lists them; logging one expands to per-ingredient nutrient math via the resolution logic in §5 of the schema doc.

---

## 5. Architecture for future sources

The whole point of this section is that adding Open Food Facts or LLM decomposition later is **registering a provider, not a refactor**.

```ts
export type Provenance = {
  source: 'ifct2017' | 'off' | 'fdc' | 'llm' | 'manual';
  confidence: 'measured' | 'label' | 'estimated';
  sourceRef?: string;
  fetchedAt?: string;
};

export type FoodCandidate = {
  id?: string;                 // set if already in local catalog
  name: string;
  foodGroup?: string;
  nutrients: Partial<Record<NutrientKey, number>>;  // per 100 g, canonical units
  portions: { label: string; grams: number }[];
  provenance: Provenance;
  needsConfirmation: boolean;  // true for anything not from local catalog
};

export interface FoodProvider {
  readonly id: Provenance['source'];
  readonly priority: number;             // lower runs first
  canHandle(q: FoodQuery): boolean;
  search(q: FoodQuery, signal: AbortSignal): Promise<FoodCandidate[]>;
}
```

MVP registers exactly one provider, `LocalCatalogProvider`. The resolver walks registered providers in priority order and stops at the first non-empty result.

Three rules that make later providers cheap:

1. **Every provider returns `FoodCandidate`.** No provider-specific shapes leak into UI or state.
2. **Nothing enters the catalog without confirmation.** `needsConfirmation: true` routes through a review sheet before any write. MVP never sets it, but the code path exists and is exercised by a test.
3. **Provenance is written on every food row from day one**, even though MVP only ever writes `ifct2017` / `measured`. Backfilling provenance later is a migration; writing it now is a column. `fetched_via`, `fetch_confidence`, `fetch_payload`, and `confirmed_at` are already in the `food` DDL in the schema doc.

---

## 6. Screens

### 6.1 Today — the default route

Date strip at top (yesterday / today / tomorrow, tap to open a picker). Then the KPI block, then the five meal sections.

KPI block: a calorie ring showing consumed vs target with remaining in the centre, and three macro bars beneath. Over-target renders in `stone-600`, not red — this is information, not a scolding.

Each meal section shows its slot name, its calorie subtotal, and its entries. An empty slot shows a single-line "add" affordance, not a large empty state.

Each entry row: food name, `entered_grams` with unit and state, calories. Swipe or long-press for edit and delete. **Edit and delete must be in the MVP** — the first mistyped quantity with no way to fix it kills trust in the numbers.

Footer of the day: an honest coverage line. "3 of 11 entries estimated" when yield conversion or non-measured data was involved. If a large share of a day is estimated, the total is decoration and the UI should say so quietly.

### 6.2 Add food

Route carries the target meal slot. Order on screen, top to bottom:

1. **Recents** — last 10 distinct foods for this slot, most recent first
2. **Frequents** — top 10 by all-time log count for this slot
3. **Search box** — searches `food_alias.alias` and `food.name`

Recents and frequents come first on purpose. After two weeks the search box should be near-dead for everyday eating, and that is what buys the 10-second target.

Search behaviour: case-insensitive prefix match on alias, then trigram similarity on name. Debounce 150 ms. Query the IndexedDB cache, not the network — 542 foods and 5,308 aliases is a trivial local index and makes search feel instant and work offline.

Tapping a result opens the quantity sheet inline. Do not navigate to a detail page to log.

### 6.3 Quantity sheet

Portion chips from `food_portion` (1 katori, 1 roti, 100 g …) with a numeric field for a multiplier, plus a raw/cooked segmented control that only appears when a yield factor other than 1.0 resolves for that food.

**Pre-fill with the last-used portion and quantity for this food.** This single behaviour is most of the difference between 10 seconds and 40.

Live-update calories and the three macros as the quantity changes. Show raw-equivalent grams as a muted subline when cooked is selected, so the conversion is visible rather than magic.

### 6.4 Food detail

Full per-100 g breakdown of all 29 nutrients, grouped macro / lipid / mineral / vitamin. Source and confidence rendered plainly at the bottom — `IFCT 2017 · B020 · measured`. B12 shows "not measured in source", never `0`. Energy derived by Atwater is labelled as such.

### 6.5 Meals

List of saved meals with per-serving calories and macros. Tap to log into a slot; long-press to edit ingredients or delete. Creation happens only via "save as meal" from a day's logged items — there is no blank-slate builder.

### 6.6 Profile

Body stats, activity, goal, macro split sliders constrained to sum to 100, timezone. Shows the computed BMR, TDEE, and resulting targets so the arithmetic is inspectable rather than a black box.

### 6.7 History

A 7-day calorie bar strip against the target line, and a tappable list of days. Nothing more.

---

## 7. Build phases

Each phase ends at a working, verifiable state. Stop and confirm before starting the next.

### Phase 0 — Foundation
Next.js + TS + Tailwind + shadcn scaffold. Supabase project, magic-link auth, protected layout. Serwist PWA shell with manifest and icons. Design tokens as CSS variables.
**Done when:** you can install to home screen, sign in by email, and see an authenticated empty shell.

### Phase 1 — Data layer
All migrations, RLS policies, `resolve_yield`, seed loads for `nutrient`, `food`, `food_alias`, `food_nutrient`, `food_yield`. Dexie catalog cache with a version stamp so it only re-downloads when the catalog changes.
**Done when:** a test asserts `rajma` returns the three Rajmah rows offline from IndexedDB, and B020's calcium reads 126 mg.

### Phase 2 — The logging loop
Add food (recents / frequents / search) → quantity sheet → Today view with entries, edit, delete. No KPI block yet.
**Done when:** you can log a full day and the day's calorie subtotal per meal is correct against a hand calculation.

### Phase 3 — Profile and targets
Profile form, Mifflin-St Jeor, clamped targets, `daily_target` upsert. KPI ring and macro bars on Today.
**Done when:** changing activity level visibly moves the target, and the floor guardrail triggers on a deliberately extreme profile.

### Phase 4 — Saved meals
"Save as meal" from selected day entries, Meals tab, log a meal into a slot, edit ingredients.
**Done when:** a 4-ingredient meal logs in one tap and its macros equal the sum of logging the ingredients separately.

### Phase 5 — Polish and honesty
Portion presets and calibration, estimated markers, coverage line, History strip, empty states, offline read verification.
**Done when:** airplane mode still lets you search the catalog and view past days, and every estimated number is visibly marked.

---

## 8. Acceptance criteria

| # | Criterion |
|---|---|
| 1 | Logging a food from Recents takes ≤3 taps and ≤10 s |
| 2 | Search for `rajma`, `maida`, `haldi`, `palak` returns correct foods offline |
| 3 | 100 g cooked rice logs as 37.0 g raw equivalent and ~134 kcal |
| 4 | 15 g ghee logs as 135 kcal, not 0 |
| 5 | B12 renders as "not measured", never `0` |
| 6 | Deleting an entry updates day and meal totals immediately |
| 7 | Calorie target never falls below `max(1200, BMR × 0.85)` |
| 8 | A saved meal's macros equal the sum of its ingredients logged individually |
| 9 | Editing a saved meal does not change previously logged entries |
| 10 | RLS: a second signed-in user sees none of the first user's data |
| 11 | Day boundary respects `profile.timezone`, not the server's |
| 12 | Lighthouse PWA installable, performance ≥90 on mobile |

Criterion 9 is the one most likely to be silently broken. `log_entry_nutrient` is a snapshot table for exactly this reason — write a test.

---

## 9. Known limitations to surface in the UI

1. Yield factors are estimates, not measurements — mark converted entries.
2. Nutrient retention through cooking is not modelled; water-soluble vitamins are overstated on boiled foods.
3. B12 is absent from IFCT entirely.
4. 36 foods have an energy value that disagrees with Atwater by >25% — see `out/warnings.csv`.
5. Catalog is 542 raw Indian ingredients. No packaged goods, no restaurant food, no oats.

Limitation 5 is the one that will make you want Open Food Facts within a fortnight. That is expected and the provider abstraction is there for it. Do not pull it forward into the MVP.

---

## 10. Open questions

1. Portion presets — seed a starter set (katori, roti, glass, tbsp) for the top ~40 foods, or start empty and let it accumulate as you calibrate?
2. History retention — keep `log_entry_nutrient` forever, or roll up to daily totals after 90 days? Storage says forever is fine for years.
3. Should "save as meal" default the serving count to 1, or ask?
