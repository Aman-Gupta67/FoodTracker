"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
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
      <main className="flex-1 px-4 py-4">
        <p className="text-sm text-stone-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Profile</h1>
        <Link href="/history" className="text-sm text-primary-700">
          History →
        </Link>
      </div>

      <Field label="Display name" info={FIELD_INFO.displayName}>
        <input
          type="text"
          value={input.displayName ?? ""}
          onChange={(e) => update("displayName", e.target.value)}
          className="h-10 w-full field-input"
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
          className="h-10 w-full field-input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)" info={FIELD_INFO.height}>
          <input
            type="number"
            value={input.heightCm}
            onChange={(e) => update("heightCm", Number(e.target.value) || 0)}
            className="h-10 w-full field-input"
          />
        </Field>
        <Field label="Weight (kg)" info={FIELD_INFO.weight}>
          <input
            type="number"
            value={input.weightKg}
            onChange={(e) => update("weightKg", Number(e.target.value) || 0)}
            className="h-10 w-full field-input"
          />
        </Field>
      </div>

      <div className="rounded-md border border-stone-200 px-3 py-2 text-sm">
        BMI: <span className="font-medium">{bmi.toFixed(1)}</span>{" "}
        <span className="text-stone-500">({bmiCategory(bmi)})</span>
      </div>

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
            className="w-full"
          />
          <p className="text-xs text-stone-500">{rateMagnitude.toFixed(2)} kg/week</p>
        </Field>
      ) : null}

      <Field
        label={`Macro split (must sum to 100 — currently ${pctSum})`}
        info={FIELD_INFO.macroSplit}
      >
        <div className="grid grid-cols-3 gap-2">
          <PctInput label="Protein %" value={input.proteinPct} onChange={(v) => update("proteinPct", v)} />
          <PctInput label="Carb %" value={input.carbPct} onChange={(v) => update("carbPct", v)} />
          <PctInput label="Fat %" value={input.fatPct} onChange={(v) => update("fatPct", v)} />
        </div>
        {!pctValid ? (
          <p className="mt-1 text-xs text-red-600">Must sum to 100 to save.</p>
        ) : null}
      </Field>

      <Field label="Timezone" info={FIELD_INFO.timezone}>
        <input
          type="text"
          value={input.timezone}
          onChange={(e) => update("timezone", e.target.value)}
          className="h-10 w-full field-input"
        />
      </Field>

      <div className="rounded-md bg-stone-100 p-3 text-sm">
        <p>Age: {preview.age}</p>
        <p>BMR (resting): {preview.bmr.toFixed(0)} kcal</p>
        <p>Maintenance calories (TDEE): {preview.tdee.toFixed(0)} kcal</p>
        {input.goal !== "maintain" ? (
          <p className="text-stone-600">
            {preview.deficitOrSurplus < 0 ? "Deficit" : "Surplus"}:{" "}
            {preview.deficitOrSurplus >= 0 ? "+" : ""}
            {preview.deficitOrSurplus.toFixed(0)} kcal/day
          </p>
        ) : null}
        <p className="font-medium">
          Calorie target: {preview.calorieTarget.toFixed(0)} kcal
        </p>
        {preview.isFloored ? (
          <p className="text-xs text-stone-600">
            Floored at {preview.calorieFloor.toFixed(0)} kcal — your unclamped
            calculation gave {preview.rawCalorieTarget.toFixed(0)} kcal. We
            never go below 1200 kcal or 85% of your BMR.
          </p>
        ) : null}
        <p>Protein: {preview.proteinG.toFixed(0)} g</p>
        <p>Carb: {preview.carbG.toFixed(0)} g</p>
        <p>Fat: {preview.fatG.toFixed(0)} g</p>
      </div>

      <Button onClick={handleSave} disabled={!pctValid || saveProfile.isPending}>
        {saveProfile.isPending ? "Saving…" : "Save"}
      </Button>
      {saved ? <p className="text-sm text-primary-700">Saved.</p> : null}
      {saveProfile.isError ? (
        <p className="text-sm text-red-600">
          {getErrorMessage(saveProfile.error)}
        </p>
      ) : null}

      <div className="border-t border-stone-200 pt-4">
        <SignOutButton />
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
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="text-sm text-red-600 disabled:opacity-50"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
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
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-stone-600">
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
        "rounded-full border px-3 py-1.5 text-sm capitalize " +
        (active
          ? "border-primary-500 bg-primary-100 text-primary-700"
          : "border-stone-300 text-stone-700")
      }
    >
      {children}
    </button>
  );
}

function PctInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-full field-input"
      />
      <p className="mt-0.5 text-center text-[10px] text-stone-500">{label}</p>
    </div>
  );
}
