"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useDashboardData } from "@/lib/dashboard/hooks";
import { useDailyTargets } from "@/lib/profile/hooks";
import { getTodayDateString, shiftDateString } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";

type RangeDays = 7 | 15 | 30;
const RANGE_OPTIONS: RangeDays[] = [7, 15, 30];

interface ChartPoint {
  date: string;
  calories: number;
  targetCalories: number | null;
  protein: number;
  targetProtein: number | null;
  carb: number;
  targetCarb: number | null;
  fat: number;
  targetFat: number | null;
  weight: number | null;
}

function formatShort(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tooltipStyle = {
  borderRadius: 12,
  border: "none",
  boxShadow: "0 4px 16px -4px rgba(41,37,36,.2)",
  fontSize: 11,
  padding: "6px 10px",
};

export function DashboardClient() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const today = getTodayDateString();
  const startDate = shiftDateString(today, -(rangeDays - 1));

  const { data: dashboardData, isLoading } = useDashboardData(startDate, today);
  const { data: targets } = useDailyTargets();

  const macroTotals = dashboardData?.macroTotals;
  const weightLog = dashboardData?.weightLog;

  const weightByDate = new Map((weightLog ?? []).map((w) => [w.date, w.weightKg]));
  const days = Array.from({ length: rangeDays }, (_, i) => shiftDateString(startDate, i));
  const data: ChartPoint[] = days.map((date) => {
    const m = macroTotals?.[date] ?? { calories: 0, protein: 0, carb: 0, fat: 0 };
    return {
      date,
      calories: m.calories,
      targetCalories: targets?.calorieTarget ?? null,
      protein: m.protein,
      targetProtein: targets?.proteinG ?? null,
      carb: m.carb,
      targetCarb: targets?.carbG ?? null,
      fat: m.fat,
      targetFat: targets?.fatG ?? null,
      weight: weightByDate.get(date) ?? null,
    };
  });
  const latestWeightEntry = [...data].reverse().find((d) => d.weight !== null);
  const latestWeight = latestWeightEntry?.weight ?? null;

  return (
    <main className="flex-1 px-4 py-4">
      <div className="mb-3.5 flex items-center gap-2.5">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-200"
        >
          <ChevronLeft size={20} />
        </Link>
        <p className="text-lg font-extrabold tracking-tight">Dashboard</p>
      </div>

      <div className="mb-3.5 flex rounded-full bg-white p-1 shadow-sm">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setRangeDays(opt)}
            className={
              "flex-1 rounded-full py-2 text-[12.5px] font-bold transition-colors " +
              (rangeDays === opt
                ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
                : "text-stone-500")
            }
          >
            {opt} days
          </button>
        ))}
      </div>

      <div className="mb-3.5 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
          <span className="h-0.5 w-3.5 rounded bg-stone-700" />
          Actual
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
          <span className="h-0 w-3.5 border-t-2 border-dashed border-stone-400" />
          Target
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="mb-2.5 grid grid-cols-2 gap-2.5">
            <KpiChart
              label="Calories"
              unit="kcal"
              color="var(--color-primary-600)"
              data={data}
              dataKey="calories"
              targetKey="targetCalories"
            />
            <KpiChart
              label="Protein"
              unit="g"
              color="var(--color-protein)"
              data={data}
              dataKey="protein"
              targetKey="targetProtein"
            />
            <KpiChart
              label="Carbs"
              unit="g"
              color="var(--color-carbs)"
              data={data}
              dataKey="carb"
              targetKey="targetCarb"
            />
            <KpiChart
              label="Fat"
              unit="g"
              color="var(--color-fat)"
              data={data}
              dataKey="fat"
              targetKey="targetFat"
            />
          </div>

          <div className="rounded-2xl bg-white p-3.5 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="text-[12.5px] font-bold text-stone-600">Weight</p>
              <p className="text-base font-extrabold">
                {latestWeight !== null ? latestWeight.toFixed(1) : "—"}{" "}
                <span className="text-[10px] font-semibold text-stone-400">kg</span>
              </p>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <XAxis dataKey="date" hide />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-primary-600)"
                  strokeWidth={2.5}
                  // Weight is logged at most once a day (only on a profile
                  // save), so a short range often has just one or two real
                  // points — with dots off, an unconnectable single point
                  // rendered nothing at all even though the data was there.
                  dot={{ r: 3, fill: "var(--color-primary-600)", strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(d) => formatShort(String(d))}
                  formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Weight"]}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[10px] font-semibold text-stone-400">
              <span>{formatShort(days[0]!)}</span>
              <span>Today</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function KpiChart({
  label,
  unit,
  color,
  data,
  dataKey,
  targetKey,
}: {
  label: string;
  unit: string;
  color: string;
  data: ChartPoint[];
  dataKey: keyof ChartPoint;
  targetKey: keyof ChartPoint;
}) {
  const latest = data[data.length - 1]?.[dataKey];
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold text-stone-600">{label}</p>
      <p className="mb-0.5 text-[15px] font-extrabold" style={{ color }}>
        {typeof latest === "number" ? latest.toFixed(0) : "—"}{" "}
        <span className="text-[9.5px] font-semibold text-stone-400">{unit}</span>
      </p>
      <ResponsiveContainer width="100%" height={52}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="date" hide />
          <Line
            type="monotone"
            dataKey={targetKey}
            stroke="var(--color-stone-300)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => formatShort(String(d))}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
