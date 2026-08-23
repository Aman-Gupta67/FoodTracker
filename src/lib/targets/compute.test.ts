import { describe, expect, it } from "vitest";
import { bmiCategory, computeBmi, computeTargets, MIN_CALORIE_FLOOR } from "./compute";

// A fixed reference date of birth is used throughout so age (and therefore
// BMR) is deterministic regardless of when the test runs.
const THIRTY_YEARS_AGO = new Date();
THIRTY_YEARS_AGO.setFullYear(THIRTY_YEARS_AGO.getFullYear() - 30);
const DOB = THIRTY_YEARS_AGO.toISOString().slice(0, 10);

describe("computeTargets", () => {
  it("moves the target when activity level changes", () => {
    const base = {
      sex: "male" as const,
      dateOfBirth: DOB,
      heightCm: 175,
      weightKg: 75,
      goal: "maintain" as const,
      goalRateKgWeek: 0,
      proteinPct: 30,
      carbPct: 40,
      fatPct: 30,
    };

    const sedentary = computeTargets({ ...base, activity: "sedentary" });
    const active = computeTargets({ ...base, activity: "active" });

    expect(active.tdee).toBeGreaterThan(sedentary.tdee);
    expect(active.calorieTarget).toBeGreaterThan(sedentary.calorieTarget);
  });

  it("floors the calorie target on a deliberately extreme profile", () => {
    // Small, light frame + max deficit — should hit the floor.
    const extreme = computeTargets({
      sex: "female",
      dateOfBirth: DOB,
      heightCm: 150,
      weightKg: 42,
      activity: "sedentary",
      goal: "lose",
      goalRateKgWeek: -0.75,
      proteinPct: 30,
      carbPct: 40,
      fatPct: 30,
    });

    expect(extreme.isFloored).toBe(true);
    expect(extreme.calorieTarget).toBeGreaterThanOrEqual(MIN_CALORIE_FLOOR);
    expect(extreme.calorieTarget).toBe(extreme.calorieFloor);
    expect(extreme.calorieTarget).toBeGreaterThan(extreme.rawCalorieTarget);
  });

  it("clamps goalRateKgWeek to ±0.75 even if a caller passes more", () => {
    const result = computeTargets({
      sex: "male",
      dateOfBirth: DOB,
      heightCm: 175,
      weightKg: 75,
      activity: "moderate",
      goal: "gain",
      goalRateKgWeek: 5, // way beyond the cap
      proteinPct: 30,
      carbPct: 40,
      fatPct: 30,
    });

    expect(result.clampedGoalRateKgWeek).toBe(0.75);
  });

  it("does not floor a reasonable maintenance target", () => {
    const result = computeTargets({
      sex: "male",
      dateOfBirth: DOB,
      heightCm: 175,
      weightKg: 75,
      activity: "moderate",
      goal: "maintain",
      goalRateKgWeek: 0,
      proteinPct: 30,
      carbPct: 40,
      fatPct: 30,
    });

    expect(result.isFloored).toBe(false);
    expect(result.calorieTarget).toBe(result.rawCalorieTarget);
  });

  it("reports the deficit/surplus relative to maintenance calories", () => {
    const losing = computeTargets({
      sex: "male",
      dateOfBirth: DOB,
      heightCm: 175,
      weightKg: 75,
      activity: "active",
      goal: "lose",
      goalRateKgWeek: -0.75,
      proteinPct: 30,
      carbPct: 40,
      fatPct: 30,
    });

    expect(losing.deficitOrSurplus).toBeLessThan(0);
    expect(losing.calorieTarget - losing.tdee).toBeCloseTo(
      losing.deficitOrSurplus,
      5,
    );
  });
});

describe("computeBmi / bmiCategory", () => {
  it("computes BMI as weight / height(m)^2", () => {
    expect(computeBmi(175, 75)).toBeCloseTo(24.49, 1);
  });

  it("categorizes BMI per WHO adult bands", () => {
    expect(bmiCategory(17)).toBe("underweight");
    expect(bmiCategory(22)).toBe("normal");
    expect(bmiCategory(27)).toBe("overweight");
    expect(bmiCategory(32)).toBe("obese");
  });
});
