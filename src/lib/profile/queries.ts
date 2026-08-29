import { createClient, getAuthedClient, type AuthedClient } from "@/lib/supabase/client";
import { computeTargets } from "@/lib/targets/compute";
import { getTodayDateString } from "@/lib/date";
import type { DailyTargets, Profile, ProfileInput } from "./types";

const NUTRIENT_ID = { energy: 1, protein: 2, fat: 3, carb: 4 } as const;

interface RawProfileRow {
  user_id: string;
  display_name: string | null;
  sex: Profile["sex"];
  date_of_birth: string;
  height_cm: number;
  weight_kg: number;
  activity: Profile["activity"];
  goal: Profile["goal"];
  goal_rate_kg_week: number;
  protein_pct: number;
  carb_pct: number;
  fat_pct: number;
  timezone: string;
}

function mapProfile(r: RawProfileRow): Profile {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    sex: r.sex,
    dateOfBirth: r.date_of_birth,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    activity: r.activity,
    goal: r.goal,
    goalRateKgWeek: r.goal_rate_kg_week,
    proteinPct: r.protein_pct,
    carbPct: r.carb_pct,
    fatPct: r.fat_pct,
    timezone: r.timezone,
  };
}

export async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data as RawProfileRow) : null;
}

// "Compute on profile save and upsert" — mvp-build-plan.md §4.4.
// daily_target is derived and persisted here, not recomputed on every read.
export async function saveProfileAndTargets(input: ProfileInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const targets = computeTargets(input);

  const { error: profileError } = await supabase.from("profile").upsert({
    user_id: user.id,
    display_name: input.displayName,
    sex: input.sex,
    date_of_birth: input.dateOfBirth,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    activity: input.activity,
    goal: input.goal,
    goal_rate_kg_week: targets.clampedGoalRateKgWeek,
    protein_pct: input.proteinPct,
    carb_pct: input.carbPct,
    fat_pct: input.fatPct,
    timezone: input.timezone,
  });
  if (profileError) throw profileError;

  // Builds weight history automatically from ordinary profile saves — no
  // separate "log your weight" screen needed for the Dashboard's trend chart.
  const { error: weightLogError } = await supabase.from("weight_log").upsert(
    {
      user_id: user.id,
      logged_date: getTodayDateString(),
      weight_kg: input.weightKg,
    },
    { onConflict: "user_id,logged_date" },
  );
  if (weightLogError) throw weightLogError;

  const rows = [
    { nutrient_id: NUTRIENT_ID.energy, value: targets.calorieTarget },
    { nutrient_id: NUTRIENT_ID.protein, value: targets.proteinG },
    { nutrient_id: NUTRIENT_ID.carb, value: targets.carbG },
    { nutrient_id: NUTRIENT_ID.fat, value: targets.fatG },
  ].map((r) => ({
    user_id: user.id,
    nutrient_id: r.nutrient_id,
    target_min: r.value,
    target_max: r.value,
  }));

  const { error: targetError } = await supabase
    .from("daily_target")
    .upsert(rows, { onConflict: "user_id,nutrient_id" });
  if (targetError) throw targetError;

  return targets;
}

export async function fetchDailyTargets(): Promise<DailyTargets | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("daily_target")
    .select("nutrient_id, target_min")
    .eq("user_id", user.id);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const byNutrient = new Map(data.map((r) => [r.nutrient_id, r.target_min]));
  const calorieTarget = byNutrient.get(NUTRIENT_ID.energy);
  if (calorieTarget === undefined) return null;

  return {
    calorieTarget,
    proteinG: byNutrient.get(NUTRIENT_ID.protein) ?? 0,
    carbG: byNutrient.get(NUTRIENT_ID.carb) ?? 0,
    fatG: byNutrient.get(NUTRIENT_ID.fat) ?? 0,
  };
}

// Day-by-day weight for the Dashboard's weight trend chart.
export async function fetchWeightLog(
  startDate: string,
  endDate: string,
  preAuthed?: AuthedClient,
): Promise<{ date: string; weightKg: number }[]> {
  const authed = preAuthed ?? (await getAuthedClient());
  if (!authed) return [];

  const { data, error } = await authed.supabase
    .from("weight_log")
    .select("logged_date, weight_kg")
    .gte("logged_date", startDate)
    .lte("logged_date", endDate)
    .order("logged_date", { ascending: true });

  if (error) throw error;
  return (data as { logged_date: string; weight_kg: number }[]).map((r) => ({
    date: r.logged_date,
    weightKg: r.weight_kg,
  }));
}
