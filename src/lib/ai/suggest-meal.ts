import "server-only";
import { groqJsonCompletion } from "./groq";

export interface MealSuggestionCandidate {
  id: number;
  name: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
}

export interface SuggestedItem {
  id: number;
  grams: number;
}

export interface MealSuggestion {
  items: SuggestedItem[];
  reasoning: string;
}

export interface ConsumedToday {
  totals: { calories: number; protein: number; carb: number; fat: number };
  items: { name: string; grams: number; meal: string }[];
}

// Constrained to a provided candidate list (the user's own real logging
// history, or a staple fallback) specifically to avoid hallucinating a food
// that isn't loggable — the LLM picks ids from a closed set, it never
// invents a name to be fuzzy-matched later.
const SYSTEM_PROMPT = `You are a meal-planning assistant for an Indian food-logging app.

The user has already logged what they've eaten so far today — you can see
exactly which foods, how much of each, and the resulting calories/macros
consumed. You also have their remaining calorie/macro targets for the rest
of the day, and a list of foods available to recommend from, drawn from
this specific user's own logging history (foods they've actually eaten
before) — never invent or reference a food outside this list.

Use what they've already eaten today to inform a smarter next meal: avoid
suggesting something that repeats or clashes with what's already been
eaten (e.g. don't suggest another carb-heavy item right after a
carb-heavy breakfast), and prefer a combination that rounds out the day's
nutrition sensibly given both what's already consumed and what's still
needed to hit the remaining targets.

Choose a realistic combination of 2-4 items from the available-foods list
and how many grams of each, so the total lands close to the remaining
targets. You MUST only use food ids from the provided list — never invent
a food or an id that isn't listed. It's fine to not hit the targets
exactly if the available foods don't allow it.

Respond with strict JSON, no prose, exactly this shape:
{"items": [{"id": number, "grams": number}], "reasoning": string}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function suggestMeal(
  targets: { calories: number; protein: number; carb: number; fat: number },
  candidates: MealSuggestionCandidate[],
  consumedToday: ConsumedToday,
): Promise<MealSuggestion> {
  const userPrompt = JSON.stringify({
    remainingTargets: targets,
    consumedToday,
    availableFoods: candidates,
  });

  const raw = await groqJsonCompletion(SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse the AI's response as JSON.");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new Error("AI response is missing an 'items' array.");
  }

  const validIds = new Set(candidates.map((c) => c.id));
  const items: SuggestedItem[] = parsed.items
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.id === "number" &&
        typeof item.grams === "number" &&
        validIds.has(item.id),
    )
    .map((item) => ({ id: item.id as number, grams: item.grams as number }));

  if (items.length === 0) {
    throw new Error("The AI didn't suggest any valid items — try again.");
  }

  return {
    items,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}
