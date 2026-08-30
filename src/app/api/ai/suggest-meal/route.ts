import { NextResponse } from "next/server";
import {
  suggestMeal,
  type ConsumedToday,
  type MealSuggestionCandidate,
} from "@/lib/ai/suggest-meal";
import { createClient } from "@/lib/supabase/server";

function isValidCandidate(c: unknown): c is MealSuggestionCandidate {
  return (
    typeof c === "object" &&
    c !== null &&
    typeof (c as MealSuggestionCandidate).id === "number" &&
    typeof (c as MealSuggestionCandidate).name === "string"
  );
}

function isValidConsumedToday(v: unknown): v is ConsumedToday {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c.totals === "object" && c.totals !== null && Array.isArray(c.items);
}

// Groq calls plus a cold serverless-function start can occasionally
// exceed the platform's default function timeout, killing the request
// mid-flight (surfaces client-side as a generic "Load failed"/"Failed to
// fetch") — the client already retries once on that shape of failure,
// but giving the function more room to begin with means it rarely needs to.
export const maxDuration = 30;

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

  const { targets, candidates, consumedToday } = (body ?? {}) as {
    targets?: unknown;
    candidates?: unknown;
    consumedToday?: unknown;
  };

  if (
    typeof targets !== "object" ||
    targets === null ||
    !Array.isArray(candidates) ||
    !candidates.every(isValidCandidate) ||
    !isValidConsumedToday(consumedToday)
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const suggestion = await suggestMeal(
      targets as { calories: number; protein: number; carb: number; fat: number },
      candidates,
      consumedToday,
    );
    return NextResponse.json(suggestion);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
