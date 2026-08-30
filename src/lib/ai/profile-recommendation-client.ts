import type { ProfileRecommendation } from "./profile-recommendation";
import { fetchJsonWithRetry } from "./fetch-json";

export interface ProfileRecommendationRequest {
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

export async function requestProfileRecommendation(
  input: ProfileRecommendationRequest,
): Promise<ProfileRecommendation> {
  const { res, body } = await fetchJsonWithRetry("/api/ai/profile-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? "Could not get an analysis.");
  }
  return body as ProfileRecommendation;
}
