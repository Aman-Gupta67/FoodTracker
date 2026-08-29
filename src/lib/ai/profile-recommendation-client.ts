import type { ProfileRecommendation } from "./profile-recommendation";

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
  const res = await fetch("/api/ai/profile-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Could not get an analysis.");
  }
  return body as ProfileRecommendation;
}
