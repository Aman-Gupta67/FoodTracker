import "server-only";
import { groqJsonCompletion } from "./groq";

export interface ProfileRecommendationInput {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  activity: string;
  goal: string;
  goalRateKgWeek: number;
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface ProfileRecommendation {
  summary: string;
  suggestions: string[];
}

// Advisory only — this never writes back into the profile form. The app's
// "nothing enters without confirmation" posture (CLAUDE.md) applies here
// too: the AI can flag and suggest, the user decides what to change.
const SYSTEM_PROMPT = `You are a nutrition coach reviewing a user's profile settings for an Indian food-tracking app.
Given their body stats, activity level, goal, and already-computed calorie/macro
targets, give a short, practical analysis: whether the targets look reasonable
for their stated goal, anything worth flagging (an aggressive rate, unusually
low/high protein, an activity level that seems mismatched with the goal), and
2-4 concrete, actionable suggestions.

Be direct and specific, not generic wellness copy. Do not diagnose medical
conditions or recommend supplements. If the BMI or goal rate looks like it
could use medical supervision, say so plainly and suggest consulting a doctor
rather than working around it.

Respond with strict JSON, no prose, exactly this shape:
{"summary": string, "suggestions": [string, ...]}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getProfileRecommendation(
  input: ProfileRecommendationInput,
): Promise<ProfileRecommendation> {
  const raw = await groqJsonCompletion(SYSTEM_PROMPT, JSON.stringify(input));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse the AI's response as JSON.");
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.suggestions)
  ) {
    throw new Error("AI response is missing summary/suggestions.");
  }

  return {
    summary: parsed.summary,
    suggestions: parsed.suggestions.filter((s): s is string => typeof s === "string"),
  };
}
