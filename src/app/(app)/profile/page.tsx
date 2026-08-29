"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AiRecommendationSection } from "@/components/profile/ai-recommendation-section";
import { getErrorMessage } from "@/lib/error";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useSaveProfile } from "@/lib/profile/hooks";
import type { ProfileInput } from "@/lib/profile/types";
import {
  bmiCategory,
  computeBmi,
  computeTargets,
  MAX_GOAL_RATE_KG_WEEK,
  type ActivityLevel,
  type BodyGoal,
} from "@/lib/targets/compute";

const DEFAULT_INPUT: ProfileInput = {
  displayName: "",
  sex: "male",
  dateOfBirth: "1995-01-01",
  heightCm: 170,
  weightKg: 70,
  activity: "sedentary",
  goal: "maintain",
  goalRateKgWeek: 0,
  proteinPct: 30,
  carbPct: 40,
  fatPct: 30,
  timezone: "Asia/Kolkata",
};

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" },
];

const GOAL_OPTIONS: { value: BodyGoal; label: string }[] = [
  { value: "lose", label: "Lose" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain" },
];

const FIELD_INFO = {
  displayName: "Just a label for your own profile — not used in any calculation.",
  sex: "Sex at birth. Used only because the Mifflin-St Jeor formula for estimating your resting metabolism (BMR) uses a different constant for males and females.",
  dateOfBirth: "Used to compute your age, which is one of the four inputs to your BMR (resting-metabolism) estimate.",
  height: "Used in your BMR estimate and to compute BMI (weight ÷ height²).",
  weight: "Used in your BMR estimate and to compute BMI.",
  activity:
    "Multiplies your BMR to estimate total daily calories burned (TDEE / maintenance calories). Sedentary ×1.2, Light ×1.375, Moderate ×1.55, Active ×1.725, Very active ×1.9. Pick based on your actual weekly activity, not your goal — overestimating this is the most common way a calorie target ends up wrong.",
  goal: "Sets the direction: Lose applies a calorie deficit below maintenance, Gain applies a surplus, Maintain applies neither (the rate below only appears for Lose/Gain).",
  rate: `How aggressively to pursue the goal, in kg of bodyweight per week. Capped at ±${MAX_GOAL_RATE_KG_WEEK} kg/week as a safety guardrail — that's already an aggressive rate, not a target to aim for by default. Each kg/week of change is roughly a 1100 kcal/day deficit or surplus (7700 kcal per kg, over 7 days).`,
  macroSplit:
    "How your calorie target divides between protein, carbs, and fat, by percentage of calories. Protein and carbs are 4 kcal/g; fat is 9 kcal/g — that's why the same percentage gives fewer grams of fat than protein.",
  timezone:
    "Determines when \"today\" rolls over to the next day for your log. Set this to where you actually eat — otherwise a late-night snack could get logged onto the wrong day.",
};

export default function ProfilePage() {
  const { data: existingProfile, isLoading } = useProfile();
  const saveProfile = useSaveProfile();

  const [input, setInput] = useState<ProfileInput>(DEFAULT_INPUT);
  const [rateMagnitude, setRateMagnitude] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      const { userId: _userId, ...rest } = existingProfile as ProfileInput & {
        userId?: string;
      };
      void _userId;
      setInput(rest);
      setRateMagnitude(Math.abs(existingProfile.goalRateKgWeek));
    }
  }, [existingProfile]);

  const pctSum = input.proteinPct + input.carbPct + input.fatPct;
  const pctValid = pctSum === 100;

  const signedRate =
    input.goal === "lose"
      ? -rateMagnitude
      : input.goal === "gain"
        ? rateMagnitude
        : 0;

  const preview = useMemo(
    () => computeTargets({ ...input, goalRateKgWeek: signedRate }),
    [input, signedRate],
  );
  const bmi = useMemo(
    () => computeBmi(input.heightCm, input.weightKg),
    [input.heightCm, input.weightKg],
  );

  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setSaved(false);
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!pctValid) return;
    await saveProfile.mutateAsync({ ...input, goalRateKgWeek: signedRate });
    setSaved(true);
  }

  if (isLoading) {
    return (
      <main className="flex-1 space-y-3 px-4 py-4">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    );
  }

  const initial = input.displayName?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <main className="flex-1 pb-4">
      <div className="flex items-center gap-3.5 rounded-b-3xl bg-gradient-to-br from-primary-400 to-primary-600 px-5 py-6">
        <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-2xl border-2 border-white/50 bg-white/20 text-xl font-extrabold text-white">
          {initial}
        </div>
        <div className="flex-1">
          <p className="text-lg font-extrabold text-white">
            {input.displayName?.trim() || "Your profile"}
          </p>
          <p className="text-xs font-semibold text-white/85">Edit your profile &amp; targets</p>
        </div>
        <SignOutButton />
      </div>

      <div className="space-y-3.5 px-4 pt-3.5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-700">
            About you
          </p>
          <div className="space-y-3.5">
            <Field label="Display name" info={FIELD_INFO.displayName}>
              <input
                type="text"
                value={input.displayName ?? ""}
                onChange={(e) => update("displayName", e.target.value)}
                className="h-11 w-full rounded-2xl field-input"
              />
            </Field>

            <Field label="Sex" info={FIELD_INFO.sex}>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((s) => (
                  <Chip key={s} active={input.sex === s} onClick={() => update("sex", s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Date of birth" info={FIELD_INFO.dateOfBirth}>
              <input
                type="date"
                value={input.dateOfBirth}
                onChange={(e) => update("dateOfBirth", e.target.value)}
                className="h-11 w-full rounded-2xl field-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (cm)" info={FIELD_INFO.height}>
                <input
                  type="number"
                  value={input.heightCm}
                  onChange={(e) => update("heightCm", Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl field-input"
                />
              </Field>
              <Field label="Weight (kg)" info={FIELD_INFO.weight}>
                <input
                  type="number"
                  value={input.weightKg}
                  onChange={(e) => update("weightKg", Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl field-input"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-primary-50 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-stone-600">BMI</span>
              <span className="font-extrabold text-primary-700">
                {bmi.toFixed(1)} &middot; {bmiCategory(bmi)}
              </span>
            </div>

            <Field label="Timezone" info={FIELD_INFO.timezone}>
              <input
                type="text"
                value={input.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                className="h-11 w-full rounded-2xl field-input"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-700">
            Activity &amp; goal
          </p>
          <div className="space-y-3.5">
            <Field label="Activity" info={FIELD_INFO.activity}>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={input.activity === opt.value}
                    onClick={() => update("activity", opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Goal" info={FIELD_INFO.goal}>
              <div className="flex gap-2">
                {GOAL_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={input.goal === opt.value}
                    onClick={() => update("goal", opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
            </Field>

            {input.goal !== "maintain" ? (
              <Field
                label={`Rate (kg/week, max ${MAX_GOAL_RATE_KG_WEEK})`}
                info={FIELD_INFO.rate}
              >
                <input
                  type="range"
                  min={0}
                  max={MAX_GOAL_RATE_KG_WEEK}
                  step={0.05}
                  value={rateMagnitude}
                  onChange={(e) => {
                    setSaved(false);
                    setRateMagnitude(Number(e.target.value));
                  }}
                  className="w-full accent-primary-600"
                />
                <p className="text-xs text-stone-500">{rateMagnitude.toFixed(2)} kg/week</p>
              </Field>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-700">
            Macro split
          </p>
          <div className="mb-3 flex h-3.5 overflow-hidden rounded-full">
            <div
              className="h-full"
              style={{ width: `${input.proteinPct}%`, backgroundColor: "var(--color-protein)" }}
            />
            <div
              className="h-full"
              style={{ width: `${input.carbPct}%`, backgroundColor: "var(--color-carbs)" }}
            />
            <div
              className="h-full"
              style={{ width: `${input.fatPct}%`, backgroundColor: "var(--color-fat)" }}
            />
          </div>
          <Field
            label={`Must sum to 100 — currently ${pctSum}`}
            info={FIELD_INFO.macroSplit}
          >
            <div className="grid grid-cols-3 gap-2">
              <PctInput
                label="Protein %"
                value={input.proteinPct}
                color="var(--color-protein)"
                onChange={(v) => update("proteinPct", v)}
              />
              <PctInput
                label="Carb %"
                value={input.carbPct}
                color="var(--color-carbs)"
                onChange={(v) => update("carbPct", v)}
              />
              <PctInput
                label="Fat %"
                value={input.fatPct}
                color="var(--color-fat)"
                onChange={(v) => update("fatPct", v)}
              />
            </div>
            {!pctValid ? (
              <p className="mt-1.5 text-xs text-red-600">Must sum to 100 to save.</p>
            ) : null}
          </Field>
        </div>

        <div className="rounded-2xl border-[1.5px] border-primary-100 bg-gradient-to-br from-white to-primary-50 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-700">
            Your targets
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <div>
              <p className="text-[11px] font-semibold text-stone-500">BMR</p>
              <p className="text-base font-extrabold">{preview.bmr.toFixed(0)} kcal</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-stone-500">TDEE</p>
              <p className="text-base font-extrabold">{preview.tdee.toFixed(0)} kcal</p>
            </div>
          </div>
          {input.goal !== "maintain" ? (
            <p className="mb-2 text-xs font-semibold text-stone-600">
              {preview.deficitOrSurplus < 0 ? "Deficit" : "Surplus"}:{" "}
              {preview.deficitOrSurplus >= 0 ? "+" : ""}
              {preview.deficitOrSurplus.toFixed(0)} kcal/day
            </p>
          ) : null}
          <div className="mb-2.5 rounded-2xl bg-white p-3.5">
            <p className="text-[11.5px] font-semibold text-stone-500">Calorie target</p>
            <p className="text-[22px] font-extrabold text-primary-700">
              {preview.calorieTarget.toFixed(0)} kcal
            </p>
          </div>
          {preview.isFloored ? (
            <p className="mb-2.5 text-xs text-stone-600">
              Floored at {preview.calorieFloor.toFixed(0)} kcal — your unclamped
              calculation gave {preview.rawCalorieTarget.toFixed(0)} kcal. We
              never go below 1200 kcal or 85% of your BMR.
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-extrabold" style={{ color: "var(--color-protein)" }}>
                {preview.proteinG.toFixed(0)}g
              </p>
              <p className="text-[9.5px] font-semibold text-stone-500">protein</p>
            </div>
            <div>
              <p className="text-sm font-extrabold" style={{ color: "var(--color-carbs)" }}>
                {preview.carbG.toFixed(0)}g
              </p>
              <p className="text-[9.5px] font-semibold text-stone-500">carb</p>
            </div>
            <div>
              <p className="text-sm font-extrabold" style={{ color: "var(--color-fat)" }}>
                {preview.fatG.toFixed(0)}g
              </p>
              <p className="text-[9.5px] font-semibold text-stone-500">fat</p>
            </div>
          </div>
        </div>

        <AiRecommendationSection
          input={{
            sex: input.sex,
            age: preview.age,
            heightCm: input.heightCm,
            weightKg: input.weightKg,
            bmi,
            activity: input.activity,
            goal: input.goal,
            goalRateKgWeek: signedRate,
            bmr: preview.bmr,
            tdee: preview.tdee,
            calorieTarget: preview.calorieTarget,
            proteinG: preview.proteinG,
            carbG: preview.carbG,
            fatG: preview.fatG,
          }}
        />

        <Button
          className="w-full rounded-2xl shadow-glow"
          onClick={handleSave}
          disabled={!pctValid || saveProfile.isPending}
        >
          {saveProfile.isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved ? <p className="text-center text-sm font-semibold text-primary-700">Saved.</p> : null}
        {saveProfile.isError ? (
          <p className="text-center text-sm text-red-600">
            {getErrorMessage(saveProfile.error)}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      aria-label="Sign out"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/90 disabled:opacity-50 active:scale-90"
    >
      <LogOut size={19} />
    </button>
  );
}

function Field({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-stone-600">
        {label}
        {info ? <InfoTooltip text={info} /> : null}
      </label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3.5 py-2 text-[13px] font-bold capitalize transition-colors " +
        (active
          ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
          : "border-[1.5px] border-stone-200 text-stone-600")
      }
    >
      {children}
    </button>
  );
}

function PctInput({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{ color }}
        className="h-11 w-full rounded-2xl field-input text-center font-bold"
      />
      <p className="mt-1 text-center text-[10px] font-semibold text-stone-500">{label}</p>
    </div>
  );
}
