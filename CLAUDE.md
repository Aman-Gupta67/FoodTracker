# CLAUDE.md — Food Tracker

Standing context for anyone (human or agent) working in this repo. Read this before touching code.

---

## What this is

A single-user PWA for logging Indian food and tracking calories and macros against a computed target. Zero running cost: Vercel free tier + Supabase free tier. Built to replace a HealthifyMe subscription, not to become a product.

**The success criterion is speed, not features.** Logging a repeat meal must take under 10 seconds and no more than 3 taps. Any change that makes the repeat-logging path slower is a regression, regardless of what it adds.

---

## Documents, in order of authority

| File | Authority |
|---|---|
| `nutrition-tracker-schema.md` §4 | **Single source of truth for all DDL.** Write migrations from here. |
| `mvp-build-plan.md` | Scope, phases, screens, acceptance criteria, and the reasoning behind schema choices |
| `pipeline-runbook.md` | How the seed data was produced and how to load it |
| `import_ifct.py` | The importer that produced `out/*.csv`. Rerun it, don't hand-edit its output. |

If the build plan and the schema doc disagree on DDL, the schema doc wins and the build plan is a bug. Fix it rather than working around it.

---

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind + shadcn/ui · TanStack Query · Dexie (IndexedDB) · Serwist PWA · Supabase (Postgres, magic-link auth, RLS) · Vercel.

Charts are hand-rolled SVG. No chart library in the MVP.

Keep the dependency list short. Every package is a thing that breaks on the next Next.js major.

---

## Data invariants — violating these silently corrupts the numbers

1. **`log_entry.grams` is raw-equivalent grams, always.** IFCT is a raw-weight table. Nutrient math reads `grams` and nothing else. `entered_grams` / `entered_state` exist only to render back what the user typed.

2. **`yield_factor` is snapshotted at insert.** Recalibrating `food_yield` next month must not rewrite last month's calories.

3. **`log_entry_nutrient` is a snapshot, written once at insert, never recomputed.** Editing a `my_dish` recipe must not change entries already logged from it. This is the single most likely thing to be silently broken — there is an acceptance test for it.

4. **Nutrient amounts are per 100 g edible portion, in `nutrient.unit`** (kcal / g / mg / µg). Never store a value in source units.

5. **Missing is NULL, never 0.** Absent from `food_nutrient` means "not measured". B12 is absent for all 542 IFCT rows and `food.b12_unknown` is true on every one. Rendering it as `0` is a lie that compounds across a day.

6. **Yield resolution lives in exactly one place** — the `resolve_yield()` SQL function. Do not reimplement the food → group → 1.0 cascade in TypeScript.

7. **Calorie targets are clamped.** Floor is `max(1200, BMR × 0.85)`; `goal_rate_kg_week` is capped at ±0.75. This is enforced in a DB check constraint *and* in the app. Do not remove either.

---

## Provenance rules

Every `food` row carries `fetched_via`, `fetch_confidence`, `fetch_payload`, `confirmed_at`. The MVP only ever writes `ifct2017` / `measured`, but the columns are populated from day one — backfilling provenance later is a migration, writing it now is a column.

`fetch_confidence` drives rendering, not just record-keeping:

- `measured` — plain
- `label` — plain, with source shown
- `estimated` — visually distinguished, and counted in the day's "N of M entries estimated" coverage line

**Nothing enters the catalog without user confirmation.** Any `FoodCandidate` with `needsConfirmation: true` routes through a review sheet before a write. The MVP never sets it, but the code path exists and is exercised by a test. This is precisely where MyFitnessPal failed — unverified user submissions promoted straight to canonical, which is why "Roti — 80 cal" coexists with "Roti — 297 cal" in their catalog.

---

## Provider architecture — don't shortcut it

All food lookup goes through the `FoodProvider` interface returning `FoodCandidate`. The MVP registers exactly one provider (`LocalCatalogProvider`). Open Food Facts, FDC, and LLM dish decomposition are **planned and out of scope** — the abstraction exists so adding them later is a registration, not a refactor.

No provider-specific shape may leak into UI or state. If you find yourself writing `if (source === 'ifct2017')` in a component, the abstraction has already failed.

Do not pull OFF forward into the MVP, however much you want packaged goods. It is item 5 in the known-limitations list for a reason.

---

## Known data defects — do not "fix" these silently

- **14 cooking oils had `0` kcal in IFCT.** Patched with an Atwater fallback (`4P + 9F + 4C + 2Fibre`), validated at 2.62% median disagreement against the 528 rows that do carry energy. `food.energy_source` records `measured` vs `derived_atwater`.
- **36 foods disagree with Atwater by >25%**, clustering near a factor of exactly 2 (radish, lemon juice, skinless chicken leg). Listed in `out/warnings.csv`. **Deliberately not auto-corrected.** Heuristically overwriting measured data produces a database nobody can reason about. Correct them by hand against FDC, one at a time, with `is_curated = true`.
- **Yield factors are estimates, not measurements**, seeded `is_calibrated = false`. Any entry that went through a conversion must carry an "estimated" marker in the UI.
- **Nutrient retention through cooking is not modelled.** Mass yield only. Water-soluble vitamins are overstated by 20–50% on boiled foods. Macros are unaffected, which is why this is acceptable for the MVP — say so where micros are displayed.
- **No packaged goods, no restaurant food, no oats.** The catalog is 542 raw Indian ingredients.

---

## What not to touch

- `out/*.csv` — regenerate via `import_ifct.py`, never hand-edit
- `import_ifct.py`'s `SIMPLE_MAP` unit multipliers — they were verified against `B020 Rajmah, red` row by row
- The Atwater fallback logic — it is the only thing keeping ghee from logging as 0 kcal
- `nutrient` IDs 1–30 — they are referenced from generated CSVs and from `daily_target`

---

## Conventions

- API payload keys in **camelCase**. URL paths, headers, enum values, and RLS policy names unchanged.
- SQL identifiers `snake_case`. Enum values `snake_case`.
- Nutrient keys are camelCase and match `nutrient.key` exactly: `energy`, `protein`, `fat`, `carb`, `fiber`, `fiberSoluble`, `sugarFree`, `starch`, `fatSat`, `fatMono`, `fatPoly`, `fatTrans`, `omega3`, `omega6`, `cholesterol`, `sodium`, `potassium`, `calcium`, `iron`, `magnesium`, `zinc`, `phosphorus`, `selenium`, `vitA`, `vitC`, `vitD`, `vitE`, `vitK`, `folate`, `vitB12`.
- Day boundaries respect `profile.timezone`, never the server's.
- Primary colour `#fc8c2f`. It is **2.2:1 on white and fails WCAG AA for text** — fills only. Orange text on white must be `primary-700` or darker.
- Over-target renders in `stone-600`, not red. This is information, not a scolding.

---

## Working style

Build in the phases defined in `mvp-build-plan.md` §7. Each phase ends at a verifiable state with a stated "done when". Stop at the gate and confirm before starting the next one.

Push back when something is underspecified rather than guessing. A wrong guess about nutrient units is invisible for weeks.
