import { NextResponse } from "next/server";
import { getDayAnalysis, type DayAnalysisInput } from "@/lib/ai/day-analysis";
import { createClient } from "@/lib/supabase/server";

function isValidInput(value: unknown): value is DayAnalysisInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.goal === "string" &&
    typeof v.activity === "string" &&
    typeof v.calorieTarget === "number" &&
    typeof v.proteinTargetG === "number" &&
    typeof v.carbTargetG === "number" &&
    typeof v.fatTargetG === "number" &&
    typeof v.totals === "object" &&
    v.totals !== null &&
    Array.isArray(v.items) &&
    typeof v.micronutrients === "object" &&
    v.micronutrients !== null
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
      { error: "Missing or invalid day-analysis fields." },
      { status: 400 },
    );
  }

  try {
    const analysis = await getDayAnalysis(body);
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
