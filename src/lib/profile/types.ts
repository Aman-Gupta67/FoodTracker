import type { ActivityLevel, BodyGoal, SexAtBirth } from "@/lib/targets/compute";

export interface Profile {
  userId: string;
  displayName: string | null;
  sex: SexAtBirth;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: BodyGoal;
  goalRateKgWeek: number;
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  timezone: string;
  // Bearer token an iOS Shortcuts automation posts to /api/steps/sync with
  // — not a form field, managed separately from the rest of the profile
  // (generate/regenerate, not edited inline), so excluded from ProfileInput.
  stepsSyncToken: string | null;
}

export type ProfileInput = Omit<Profile, "userId" | "stepsSyncToken">;

export interface DailyTargets {
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}
