import { NextResponse } from "next/server";
import {
  getProfileRecommendation,
  type ProfileRecommendationInput,
} from "@/lib/ai/profile-recommendation";
import { createClient } from "@/lib/supabase/server";

function isValidInput(value: unknown): value is ProfileRecommendationInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sex === "string" &&
    typeof v.age === "number" &&
    typeof v.heightCm === "number" &&
    typeof v.weightKg === "number" &&
    typeof v.bmi === "number" &&
    typeof v.activity === "string" &&
    typeof v.goal === "string" &&
    typeof v.goalRateKgWeek === "number" &&
    typeof v.bmr === "number" &&
    typeof v.tdee === "number" &&
    typeof v.calorieTarget === "number" &&
    typeof v.proteinG === "number" &&
    typeof v.carbG === "number" &&
    typeof v.fatG === "number"
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidInput(body)) {
    return NextResponse.json(
      { error: "Missing or invalid profile fields." },
      { status: 400 },
    );
  }

  try {
    const recommendation = await getProfileRecommendation(body);
    return NextResponse.json(recommendation);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
