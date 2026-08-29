import type { DayAnalysis, DayAnalysisInput } from "./day-analysis";

export async function requestDayAnalysis(
  input: DayAnalysisInput,
): Promise<DayAnalysis> {
  const res = await fetch("/api/ai/day-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Could not get today's analysis.");
  }
  return body as DayAnalysis;
}
