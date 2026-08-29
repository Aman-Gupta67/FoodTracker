import "server-only";
import { groqJsonCompletion } from "./groq";

const SYSTEM_PROMPT = `You are helping curate search aliases for an Indian food
database, so people can find a food by whatever name they'd naturally type —
regional-language names, common transliterations, or everyday short names
(e.g. "roti"/"chapati" for wheat flour atta).

Given a food's canonical name and its existing aliases, suggest additional
aliases people might realistically search for. Do not repeat any existing
alias. Do not suggest a different food's name. If you can't think of any
genuinely useful additions, return an empty list — don't pad with
near-duplicates.

Respond with strict JSON, no prose, exactly this shape:
{"aliases": string[]}`;

export async function suggestAliases(
  foodName: string,
  existingAliases: string[],
): Promise<string[]> {
  const userPrompt = JSON.stringify({ foodName, existingAliases });
  const raw = await groqJsonCompletion(SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse the AI's response as JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { aliases?: unknown }).aliases)
  ) {
    throw new Error("AI response is missing an 'aliases' array.");
  }

  const existingLower = new Set(existingAliases.map((a) => a.toLowerCase()));
  return (parsed as { aliases: unknown[] }).aliases
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .map((a) => a.trim())
    .filter((a) => !existingLower.has(a.toLowerCase()));
}
