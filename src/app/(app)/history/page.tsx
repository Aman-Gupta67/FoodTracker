"use client";

import Link from "next/link";
import { useDailyCalorieTotals } from "@/lib/log/hooks";
import { useDailyTargets } from "@/lib/profile/hooks";
import {
  formatDateForDisplay,
  getTodayDateString,
  shiftDateString,
} from "@/lib/date";

const DAYS_BACK = 6; // 7 days total including today

export default function HistoryPage() {
  const today = getTodayDateString();
  const startDate = shiftDateString(today, -DAYS_BACK);
  const days = Array.from({ length: DAYS_BACK + 1 }, (_, i) =>
    shiftDateString(startDate, i),
  );

  const { data: totals = {}, isLoading } = useDailyCalorieTotals(
    startDate,
    today,
  );
  const { data: targets } = useDailyTargets();

  const maxValue = Math.max(
    targets?.calorieTarget ?? 0,
    ...days.map((d) => totals[d] ?? 0),
    1,
  );

  return (
    <main className="flex-1 px-4 py-4">
      <h1 className="mb-4 text-lg font-medium">History</h1>

      {isLoading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      <div className="mb-6 rounded-xl border border-stone-200 p-4 shadow-sm">
        <div className="relative flex h-32 items-end justify-between gap-2">
          {targets ? (
            <div
              className="absolute inset-x-0 border-t border-dashed border-stone-300"
              style={{
                bottom: `${(targets.calorieTarget / maxValue) * 100}%`,
              }}
            />
          ) : null}
          {days.map((d) => {
            const value = totals[d] ?? 0;
            const heightPct = Math.max(2, (value / maxValue) * 100);
            const isToday = d === today;
            return (
              <Link
                key={d}
                href={`/?date=${d}`}
                className="group flex flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-[10px] text-stone-500">
                  {value > 0 ? Math.round(value) : ""}
                </span>
                <div
                  className={
                    "w-full rounded-t transition-colors " +
                    (isToday
                      ? "bg-primary-500"
                      : "bg-primary-200 group-hover:bg-primary-300")
                  }
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] text-stone-500">
                  {new Date(d).toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
              </Link>
            );
          })}
        </div>
        {targets ? (
          <p className="mt-2 text-center text-[10px] text-stone-400">
            dashed line = {Math.round(targets.calorieTarget)} kcal target
          </p>
        ) : null}
      </div>

      <ul>
        {[...days].reverse().map((d) => (
          <li key={d}>
            <Link
              href={`/?date=${d}`}
              className="flex items-center justify-between border-b border-stone-100 py-3 text-sm hover:bg-stone-50"
            >
              <span>{formatDateForDisplay(d)}</span>
              <span className="text-stone-500">
                {totals[d] ? `${Math.round(totals[d]!)} kcal` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
