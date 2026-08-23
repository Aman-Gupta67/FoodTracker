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
}

export type ProfileInput = Omit<Profile, "userId">;

export interface DailyTargets {
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}
