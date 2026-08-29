"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestDayAnalysis } from "@/lib/ai/day-analysis-client";
import type { DayAnalysis } from "@/lib/ai/day-analysis";
import { useDailyNutrientTotals } from "@/lib/log/hooks";
import type { LogEntry } from "@/lib/log/types";
import type { DailyTargets, Profile } from "@/lib/profile/types";
import { getErrorMessage } from "@/lib/error";

export function DayAnalysisSheet({
  date,
  entries,
  targets,
  profile,
  onClose,
}: {
  date: string;
  entries: LogEntry[];
  targets: DailyTargets;
  profile: Profile | null | undefined;
  onClose: () => void;
}) {
  // Waits for the micronutrient query to settle (even to {}) rather than
  // firing on mount regardless — sending the request first would always
  // report an empty micronutrient picture.
  const { data: micronutrients, isLoading: microLoading } = useDailyNutrientTotals(
    date,
    true,
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DayAnalysis | null>(null);

  useEffect(() => {
    if (hasStarted || microLoading || micronutrients === undefined) return;
    setHasStarted(true);
    void run();

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const totals = entries.reduce(
          (sum, e) => ({
            calories: sum.calories + e.calories,
            protein: sum.protein + e.protein,
            carb: sum.carb + e.carb,
            fat: sum.fat + e.fat,
          }),
          { calories: 0, protein: 0, carb: 0, fat: 0 },
        );
        const analysis = await requestDayAnalysis({
          goal: profile?.goal ?? "maintain",
          activity: profile?.activity ?? "sedentary",
          calorieTarget: targets.calorieTarget,
          proteinTargetG: targets.proteinG,
          carbTargetG: targets.carbG,
          fatTargetG: targets.fatG,
          totals,
          items: entries.map((e) => ({
            name: e.foodName ?? e.dishName ?? "Unknown",
            grams: e.enteredGrams,
            meal: e.meal,
            calories: e.calories,
          })),
          micronutrients: micronutrients ?? {},
        });
        setResult(analysis);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setIsLoading(false);
      }
    }
  }, [hasStarted, microLoading, micronutrients, entries, targets, profile]);

  async function handleReanalyze() {
    setHasStarted(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white p-5 pb-6 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center gap-1.5">
          <Sparkles size={17} className="text-primary-600" />
          <h2 className="text-lg font-extrabold">Today&rsquo;s food score</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div>
            <p className="mb-3 text-sm text-red-600">{error}</p>
            <Button variant="outline" className="w-full rounded-2xl" onClick={handleReanalyze}>
              Try again
            </Button>
          </div>
        ) : result ? (
          <div className="space-y-3.5">
            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-white p-4 text-center">
              <p className="text-[40px] font-extrabold leading-none text-primary-700">
                {Math.round(result.foodScore)}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                out of 100
              </p>
            </div>

            <p className="text-sm text-stone-700">{result.summary}</p>

            {result.strengths.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
                  What went well
                </p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-stone-600">
                  {result.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.improvements.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
                  Could improve
                </p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-stone-600">
                  {result.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button variant="outline" className="mt-4 w-full rounded-2xl" onClick={onClose}>
          Close
        </Button>
      </motion.div>
    </div>
  );
}
