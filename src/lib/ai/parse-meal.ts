import "server-only";
import { groqJsonCompletion } from "./groq";

export interface ParsedMealItem {
  query: string;
  grams: number;
  nutrientsPer100g: {
    energy: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
  };
}

// Deliberately asks for oil/ghee and added vegetables as their own line
// items, not just the dish's headline ingredient — a bare "100g chole"
// entry silently omits the cooking oil and aromatics, systematically
// undercounting home-cooked dishes. See CLAUDE.md's auth/AI notes for the
// full reasoning.
//
// Every ingredient gets the LLM's own nutrient estimate even though most
// will already exist in the local IFCT catalog — the app prefers its own
// database values when a match is found and only falls back to this
// estimate for ingredients the catalog doesn't have, since the LLM has no
// visibility into what's actually in that catalog.
const SYSTEM_PROMPT = `You are a nutrition assistant for an Indian food-logging app.
The user describes a meal in plain language. Decompose it into the actual
ingredients used in cooking it — including any oil, ghee, or butter used for
cooking, and any onion/tomato/aromatics added, not just the dish's headline
ingredient. Estimate realistic grams for a typical home-cooked serving,
adjusted to any quantity the user mentions.

For every ingredient, provide your own best-estimate nutrition per 100g
(energy in kcal, protein/fat/carb/fiber in grams) even for common
ingredients that likely already exist in a nutrition database — your
estimate is only used as a fallback when no database match is found.

Respond with strict JSON, no prose, exactly this shape:
{"items": [{"query": string, "grams": number, "nutrientsPer100g": {"energy": number, "protein": number, "fat": number, "carb": number, "fiber": number}}]}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItem(raw: unknown, index: number): ParsedMealItem {
  if (
    !isRecord(raw) ||
    typeof raw.query !== "string" ||
    typeof raw.grams !== "number" ||
    !isRecord(raw.nutrientsPer100g)
  ) {
    throw new Error(`Malformed item at index ${index} in AI response.`);
  }
  const n = raw.nutrientsPer100g;
  return {
    query: raw.query,
    grams: raw.grams,
    nutrientsPer100g: {
      energy: Number(n.energy) || 0,
      protein: Number(n.protein) || 0,
      fat: Number(n.fat) || 0,
      carb: Number(n.carb) || 0,
      fiber: Number(n.fiber) || 0,
    },
  };
}

export async function parseMealText(text: string): Promise<ParsedMealItem[]> {
  const raw = await groqJsonCompletion(SYSTEM_PROMPT, text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse the AI's response as JSON.");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new Error("AI response is missing an 'items' array.");
  }

  return parsed.items.map(parseItem);
}
