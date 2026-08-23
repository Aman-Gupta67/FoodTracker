// Mifflin-St Jeor + TDEE + clamped calorie target, from
// mvp-build-plan.md §4.4, verbatim formulas.

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type BodyGoal = "lose" | "maintain" | "gain";
export type SexAtBirth = "male" | "female";

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// CLAUDE.md invariant #7: "Calorie targets are clamped. Floor is
// max(1200, BMR × 0.85); goal_rate_kg_week is capped at ±0.75. This is
// enforced in a DB check constraint *and* in the app." The DB CHECK covers
// goal_rate_kg_week (profile table); the calorie floor depends on BMR so
// it's enforced here in the app.
export const MAX_GOAL_RATE_KG_WEEK = 0.75;
export const MIN_CALORIE_FLOOR = 1200;

export interface ProfileInputs {
  sex: SexAtBirth;
  dateOfBirth: string; // ISO date
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: BodyGoal;
  goalRateKgWeek: number; // signed: negative for loss, positive for gain
  proteinPct: number;
  carbPct: number;
  fatPct: number;
}

export interface ComputedTargets {
  age: number;
  bmr: number;
  tdee: number;
  calorieFloor: number;
  rawCalorieTarget: number;
  calorieTarget: number;
  isFloored: boolean;
  clampedGoalRateKgWeek: number;
  // calorieTarget - tdee: negative = deficit, positive = surplus, 0 at
  // maintenance. Based on the final (post-floor) target, since that's what
  // actually applies — surfaced in the UI so a target that moves for a
  // non-obvious reason (e.g. activity level changing at the same time as
  // goal) is traceable instead of a mystery.
  deficitOrSurplus: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export function computeBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  if (heightM <= 0) return 0;
  return weightKg / (heightM * heightM);
}

// Standard WHO adult categories — informational only, not a health verdict.
export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function ageFromDateOfBirth(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function computeTargets(p: ProfileInputs): ComputedTargets {
  const age = ageFromDateOfBirth(p.dateOfBirth);

  const bmr =
    p.sex === "male"
      ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + 5
      : 10 * p.weightKg + 6.25 * p.heightCm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_FACTORS[p.activity];

  const clampedGoalRateKgWeek = Math.max(
    -MAX_GOAL_RATE_KG_WEEK,
    Math.min(MAX_GOAL_RATE_KG_WEEK, p.goalRateKgWeek),
  );

  const rawCalorieTarget = tdee + (clampedGoalRateKgWeek * 7700) / 7;
  const calorieFloor = Math.max(MIN_CALORIE_FLOOR, bmr * 0.85);
  const calorieTarget = Math.max(calorieFloor, rawCalorieTarget);
  const isFloored = calorieTarget > rawCalorieTarget;

  const proteinG = (calorieTarget * p.proteinPct) / 100 / 4;
  const carbG = (calorieTarget * p.carbPct) / 100 / 4;
  const fatG = (calorieTarget * p.fatPct) / 100 / 9;

  return {
    age,
    bmr,
    tdee,
    calorieFloor,
    rawCalorieTarget,
    calorieTarget,
    isFloored,
    clampedGoalRateKgWeek,
    deficitOrSurplus: calorieTarget - tdee,
    proteinG,
    carbG,
    fatG,
  };
}
