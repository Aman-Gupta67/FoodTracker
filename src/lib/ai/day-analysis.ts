import "server-only";
import { groqJsonCompletion } from "./groq";

export interface DayAnalysisItem {
  name: string;
  grams: number;
  meal: string;
  calories: number;
}

export interface DayAnalysisInput {
  goal: string;
  activity: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  totals: { calories: number; protein: number; carb: number; fat: number };
  items: DayAnalysisItem[];
  // Best-effort — some nutrients are absent for a given food simply because
  // IFCT never measured it (CLAUDE.md "missing is NULL, never 0"), so this
  // can understate a true total. The prompt below says so explicitly.
  micronutrients: Partial<Record<string, number>>;
}

export interface DayAnalysis {
  foodScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

const SYSTEM_PROMPT = `You are a nutrition coach reviewing one day of food logged in an Indian food-tracking app, against the user's profile goal and computed targets.

Given the day's logged items, totals, targets, and a best-effort micronutrient
summary, produce:
1. A "foodScore" from 0-100 reflecting how well today's intake matches the
   user's calorie/macro targets and goal (not a generic health score —
   specifically "did this day serve what they're trying to achieve").
2. A short summary of the day.
3. 2-5 concrete strengths (what went well, specific to what was logged).
4. 2-5 concrete improvements (what to change tomorrow, specific and
   actionable, tied to the actual gap between totals and targets).

The micronutrient figures are best-effort and can understate the true total —
IFCT (the underlying food database) doesn't have every nutrient measured for
every food, and a missing value contributes nothing rather than a false zero.
Mention this only if a micronutrient genuinely looks concerning; don't caveat
every sentence.

Be direct and specific, not generic wellness copy. Do not diagnose medical
conditions or recommend supplements.

Respond with strict JSON, no prose, exactly this shape:
{"foodScore": number, "summary": string, "strengths": [string, ...], "improvements": [string, ...]}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getDayAnalysis(input: DayAnalysisInput): Promise<DayAnalysis> {
  const raw = await groqJsonCompletion(SYSTEM_PROMPT, JSON.stringify(input));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse the AI's response as JSON.");
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.foodScore !== "number" ||
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.improvements)
  ) {
    throw new Error("AI response is missing foodScore/summary/strengths/improvements.");
  }

  return {
    foodScore: parsed.foodScore,
    summary: parsed.summary,
    strengths: parsed.strengths.filter((s): s is string => typeof s === "string"),
    improvements: parsed.improvements.filter((s): s is string => typeof s === "string"),
  };
}
