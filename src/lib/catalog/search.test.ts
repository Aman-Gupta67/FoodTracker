import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { catalogDb } from "./db";
import { searchFoodByAlias } from "./search";
import { mapFood, mapFoodAlias, mapFoodNutrient } from "./types";

// Loads the real out/*.csv seed data — the same rows Phase 1's migrations
// load into Postgres — directly into an in-memory IndexedDB (fake-indexeddb)
// so this asserts the offline query path without needing a live Supabase
// connection. Acceptance criterion: mvp-build-plan.md §7 Phase 1.

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = fields[i] ?? "";
    });
    return row;
  });
}

const toBool = (v: string | undefined) => v === "t";
const toNumOrNull = (v: string | undefined) =>
  v === undefined || v === "" ? null : Number(v);
const toStrOrNull = (v: string | undefined) =>
  v === undefined || v === "" ? null : v;

const outDir = path.join(process.cwd(), "out");

beforeAll(async () => {
  const foodRows = parseCsv(fs.readFileSync(path.join(outDir, "food.csv"), "utf8"));
  const aliasRows = parseCsv(
    fs.readFileSync(path.join(outDir, "food_alias.csv"), "utf8"),
  );
  const nutrientValueRows = parseCsv(
    fs.readFileSync(path.join(outDir, "food_nutrient.csv"), "utf8"),
  );

  await catalogDb.food.bulkAdd(
    foodRows.map((r) =>
      mapFood({
        id: Number(r.id),
        source: r.source ?? "",
        source_ref: toStrOrNull(r.source_ref),
        name: r.name ?? "",
        source_name: toStrOrNull(r.source_name),
        scientific_name: toStrOrNull(r.scientific_name),
        food_group: toStrOrNull(r.food_group),
        state: r.state ?? "",
        b12_unknown: toBool(r.b12_unknown),
        is_curated: toBool(r.is_curated),
        tags: toStrOrNull(r.tags),
        n_regions: toNumOrNull(r.n_regions),
        energy_source: r.energy_source ?? "",
      }),
    ),
  );

  await catalogDb.foodAlias.bulkAdd(
    aliasRows.map((r) =>
      mapFoodAlias({ food_id: Number(r.food_id), alias: r.alias ?? "" }),
    ),
  );

  await catalogDb.foodNutrient.bulkAdd(
    nutrientValueRows.map((r) =>
      mapFoodNutrient({
        food_id: Number(r.food_id),
        nutrient_id: Number(r.nutrient_id),
        amount: Number(r.amount),
      }),
    ),
  );
});

describe("offline catalog search (IndexedDB)", () => {
  it('resolves "rajma" to the three Rajmah rows', async () => {
    const results = await searchFoodByAlias("rajma");
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(
      ["Rajmah, black", "Rajmah, brown", "Rajmah, red"].sort(),
    );
  });

  it('falls back to a name search for "rice" (not a curated alias)', async () => {
    const results = await searchFoodByAlias("rice");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name.toLowerCase().includes("rice"))).toBe(
      true,
    );
  });

  it('merges alias and name matches for "milk" — an unrelated alias hit ("milkfish") must not suppress the real milk rows', async () => {
    const results = await searchFoodByAlias("milk");
    const names = results.map((r) => r.name);
    expect(names).toContain("Milk fish");
    expect(names).toContain("Milk, whole, Cow");
    expect(names).toContain("Milk, whole, Buffalo");
  });

  it("reads B020's calcium as 126 mg", async () => {
    const food = await catalogDb.food.where("sourceRef").equals("B020").first();
    expect(food).toBeTruthy();

    const calcium = await catalogDb.foodNutrient
      .where("[foodId+nutrientId]")
      .equals([food!.id, 18])
      .first();

    expect(calcium?.amount).toBe(126);
  });

  // Regression test for a real misidentification: an AI-parsed "water"
  // ingredient (near-universal in chai/tea recipes) used to resolve to
  // "Yam, ordinary" (aliased "water yam") or "Water melon" — both start
  // with "water" too, and resolveParsedItems only ever looks at
  // matches[0]. A synthetic fixture rather than the real out/*.csv data,
  // since this is asserting the ranking algorithm itself, not any
  // particular catalog content (which is generated, not hand-edited —
  // see CLAUDE.md "What not to touch").
  it("prefers an exact alias match over a longer alias that merely starts with the same text", async () => {
    const WATER_ID = 900001;
    const WATERMELON_ID = 900002;
    await catalogDb.food.bulkAdd([
      mapFood({
        id: WATER_ID,
        source: "user",
        source_ref: "water-test",
        name: "Water",
        source_name: "Water",
        scientific_name: null,
        food_group: "Beverages",
        state: "raw",
        b12_unknown: false,
        is_curated: true,
        tags: null,
        n_regions: null,
        energy_source: "measured",
      }),
      mapFood({
        id: WATERMELON_ID,
        source: "ifct2017",
        source_ref: "test-watermelon",
        name: "Water melon, test fixture",
        source_name: "Water melon",
        scientific_name: null,
        food_group: "Fruits",
        state: "raw",
        b12_unknown: false,
        is_curated: false,
        tags: null,
        n_regions: null,
        energy_source: "measured",
      }),
    ]);
    await catalogDb.foodAlias.bulkAdd([
      mapFoodAlias({ food_id: WATER_ID, alias: "water" }),
      mapFoodAlias({ food_id: WATERMELON_ID, alias: "watermelon" }),
    ]);

    const results = await searchFoodByAlias("water");
    expect(results[0]?.name).toBe("Water");
  });
});
