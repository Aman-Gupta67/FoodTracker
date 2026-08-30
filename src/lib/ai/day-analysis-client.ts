import type { DayAnalysis, DayAnalysisInput } from "./day-analysis";
import { fetchJsonWithRetry } from "./fetch-json";

export async function requestDayAnalysis(
  input: DayAnalysisInput,
): Promise<DayAnalysis> {
  const { res, body } = await fetchJsonWithRetry("/api/ai/day-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? "Could not get today's analysis.");
  }
  return body as DayAnalysis;
}
