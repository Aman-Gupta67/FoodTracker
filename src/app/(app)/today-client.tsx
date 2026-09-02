"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Pencil, Trash2, Sunrise, Sun, Moon, Coffee, LayoutDashboard, ChevronRight } from "lucide-react";
import {
  useDeleteLogEntry,
  useLogEntries,
  useUpdateLogEntry,
} from "@/lib/log/hooks";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type LogEntry, type MealSlot } from "@/lib/log/types";
import { getTodayDateString, shiftDateString } from "@/lib/date";
import { useDailyTargets } from "@/lib/profile/hooks";
import { useProfile } from "@/lib/profile/hooks";
import { CalorieRing } from "@/components/kpi/calorie-ring";
import { MacroBar } from "@/components/kpi/macro-bar";
import { DayAnalysisSheet } from "@/components/kpi/day-analysis-sheet";
import { FoodTile } from "@/components/ui/food-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AiMealSheet } from "@/components/logging/ai-meal-sheet";

const MEAL_ICONS: Record<MealSlot, typeof Sunrise> = {
  breakfast: Sunrise,
  morning_snack: Coffee,
  lunch: Sun,
  evening_snack: Coffee,
  dinner: Moon,
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayClient({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState(initialDate ?? getTodayDateString());
  const { data: entries = [], isLoading } = useLogEntries(date);
  const { data: targets } = useDailyTargets();
  const { data: profile } = useProfile();
  const [showDayAnalysis, setShowDayAnalysis] = useState(false);

  const byMeal = new Map<MealSlot, LogEntry[]>();
  for (const slot of MEAL_SLOTS) byMeal.set(slot, []);
  for (const entry of entries) byMeal.get(entry.meal)?.push(entry);

  const dayTotal = entries.reduce((sum, e) => sum + e.calories, 0);
  const proteinTotal = entries.reduce((sum, e) => sum + e.protein, 0);
  const carbTotal = entries.reduce((sum, e) => sum + e.carb, 0);
  const fatTotal = entries.reduce((sum, e) => sum + e.fat, 0);
  const estimatedCount = entries.filter((e) => e.isEstimated).length;

  return (
    <main className="flex-1 px-4 py-4">
      <div className="mb-1">
        <p className="text-xs font-semibold text-stone-500">{greeting()}</p>
        {profile?.displayName ? (
          <p className="text-xl font-extrabold tracking-tight">{profile.displayName}</p>
        ) : null}
      </div>

      <WeekStrip date={date} onChange={setDate} />

      {targets ? (
        <button
          type="button"
          onClick={() => setShowDayAnalysis(true)}
          className="mb-4 flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-md active:scale-[0.99]"
        >
          <CalorieRing consumed={dayTotal} target={targets.calorieTarget} />
          <div className="flex flex-1 flex-col gap-2.5">
            <MacroBar
              label="Protein"
              consumed={proteinTotal}
              target={targets.proteinG}
              color="var(--color-protein)"
              colorBg="var(--color-protein-bg)"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-protein)" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="6.5" cy="12" r="3.5" />
                  <circle cx="17.5" cy="12" r="3.5" />
                  <path d="M10 12h4" />
                </svg>
              }
            />
            <MacroBar
              label="Carbs"
              consumed={carbTotal}
              target={targets.carbG}
              color="var(--color-carbs)"
              colorBg="var(--color-carbs-bg)"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-carbs)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c2 3 2 5 0 7s-2 4 0 7" />
                  <path d="M12 2c-2 3-2 5 0 7s2 4 0 7" />
                  <path d="M12 16v6" />
                </svg>
              }
            />
            <MacroBar
              label="Fat"
              consumed={fatTotal}
              target={targets.fatG}
              color="var(--color-fat)"
              colorBg="var(--color-fat-bg)"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-fat)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3c3.5 4 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 8.5 7 12 3Z" />
                </svg>
              }
            />
          </div>
        </button>
      ) : (
        <div className="mb-4">
          <p className="text-2xl font-extrabold">{Math.round(dayTotal)} kcal</p>
          <Link href="/profile" className="text-xs text-primary-700">
            Set up your profile to see a target →
          </Link>
        </div>
      )}

      {entries.length > 0 && estimatedCount > 0 ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-1 text-[11.5px] font-semibold text-stone-600">
          {estimatedCount} of {entries.length} entr
          {entries.length === 1 ? "y" : "ies"} estimated
          {estimatedCount / entries.length > 0.5 ? " — take today's total with a grain of salt" : ""}
        </p>
      ) : null}

      <Link
        href="/dashboard"
        className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[11px] bg-primary-100">
          <LayoutDashboard size={17} className="text-primary-700" />
        </div>
        <div className="flex-1">
          <p className="text-[13.5px] font-bold">Dashboard</p>
          <p className="text-[11px] text-stone-500">Trends for calories, macros &amp; weight</p>
        </div>
        <ChevronRight size={16} className="text-stone-400" />
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyDay date={date} />
      ) : (
        <div className="space-y-4">
          {MEAL_SLOTS.map((slot) => (
            <MealSection key={slot} slot={slot} entries={byMeal.get(slot) ?? []} date={date} />
          ))}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center">
        <div className="flex w-full max-w-[480px] justify-end px-6">
          <Link
            href="/add"
            aria-label="Add food"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow transition-transform active:scale-95"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {showDayAnalysis && targets ? (
        <DayAnalysisSheet
          date={date}
          entries={entries}
          targets={targets}
          profile={profile}
          onClose={() => setShowDayAnalysis(false)}
        />
      ) : null}
    </main>
  );
}

const WEEK_STRIP_DAYS = 60;

function WeekStrip({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = getTodayDateString();
  // A rolling window of days ending today, oldest first — scrollable so
  // history further back than a week is reachable, not just a fixed 7 days.
  const days = Array.from({ length: WEEK_STRIP_DAYS }, (_, i) =>
    shiftDateString(today, i - (WEEK_STRIP_DAYS - 1)),
  );

  // Start scrolled to the right (today) rather than the oldest day.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={scrollRef} className="scrollbar-hide mb-3 flex gap-1.5 overflow-x-auto">
      {days.map((d) => {
        const isSelected = d === date;
        const dayLabel = new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
        const dayNum = Number(d.split("-")[2]);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={
              "w-11 flex-shrink-0 rounded-2xl py-2 text-center transition-colors " +
              (isSelected ? "bg-gradient-to-br from-primary-400 to-primary-600 shadow-glow" : "")
            }
          >
            <p className={"text-[11px] font-semibold " + (isSelected ? "text-white/85" : "text-stone-400")}>
              {dayLabel.slice(0, 3).toUpperCase()}
            </p>
            <p className={"text-[13px] font-bold " + (isSelected ? "text-white" : "text-stone-600")}>
              {dayNum}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function EmptyDay({ date }: { date: string }) {
  const isToday = date === getTodayDateString();
  return (
    <div className="rounded-2xl bg-white py-10 text-center shadow-sm">
      <p className="mb-3 text-sm text-stone-500">
        {isToday ? "Nothing logged yet today." : "Nothing logged this day."}
      </p>
      {isToday ? (
        <Link href="/add">
          <Button>+ Log your first item</Button>
        </Link>
      ) : null}
    </div>
  );
}

// Entries created together by one "Log this" bulk action share an
// ai_group_id — collapsed here into a single display item so the Home
// screen shows one row per logging action, not one per ingredient.
// Grouping order follows first-appearance order in `entries` (already
// consumed_at-ascending from the query), not creation order across groups.
type DisplayItem =
  | { type: "single"; entry: LogEntry }
  | { type: "group"; groupId: string; description: string; entries: LogEntry[] };

function groupEntriesForDisplay(entries: LogEntry[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const groupIndex = new Map<string, number>();
  for (const entry of entries) {
    if (entry.aiGroupId) {
      const existingIdx = groupIndex.get(entry.aiGroupId);
      const existing = existingIdx !== undefined ? items[existingIdx] : undefined;
      if (existing && existing.type === "group") {
        existing.entries.push(entry);
        continue;
      }
      groupIndex.set(entry.aiGroupId, items.length);
      items.push({
        type: "group",
        groupId: entry.aiGroupId,
        description: entry.aiGroupDescription ?? "AI meal",
        entries: [entry],
      });
    } else {
      items.push({ type: "single", entry });
    }
  }
  return items;
}

function MealSection({
  slot,
  entries,
  date,
}: {
  slot: MealSlot;
  entries: LogEntry[];
  date: string;
}) {
  const subtotal = entries.reduce((sum, e) => sum + e.calories, 0);
  const Icon = MEAL_ICONS[slot];
  const displayItems = groupEntriesForDisplay(entries);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-md">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-primary-100">
            <Icon size={16} className="text-primary-700" />
          </div>
          <span className="text-sm font-bold">{MEAL_SLOT_LABELS[slot]}</span>
        </div>
        <span className="text-xs font-semibold text-stone-500">{Math.round(subtotal)} kcal</span>
      </div>

      <AnimatePresence initial={false}>
        {displayItems.map((item) =>
          item.type === "single" ? (
            <EntryRow key={item.entry.id} entry={item.entry} date={date} />
          ) : (
            <AiMealRow
              key={item.groupId}
              description={item.description}
              entries={item.entries}
              date={date}
            />
          ),
        )}
      </AnimatePresence>

      <Link
        href={`/add?slot=${slot}`}
        className="block border-t border-stone-100 px-3.5 py-2.5 text-[12.5px] font-bold text-primary-700"
      >
        + Add to {MEAL_SLOT_LABELS[slot]}
      </Link>
    </section>
  );
}

function EntryRow({ entry, date }: { entry: LogEntry; date: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [grams, setGrams] = useState(entry.enteredGrams);
  const [state, setState] = useState(entry.enteredState);
  const deleteLogEntry = useDeleteLogEntry(date);
  const updateLogEntry = useUpdateLogEntry(date);

  const name = entry.foodName ?? entry.dishName ?? "Unknown";

  if (entry.isPending) {
    return (
      <div className="flex items-center gap-2.5 border-t border-stone-100 px-3.5 py-2 first:border-t-0">
        <Skeleton className="h-[38px] w-[38px] flex-shrink-0 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 border-t border-stone-100 px-3.5 py-2 first:border-t-0">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value) || 0)}
          className="h-8 w-20 field-input"
        />
        <select
          value={state}
          onChange={(e) => setState(e.target.value as "raw" | "cooked")}
          className="h-8 field-input"
        >
          <option value="raw">raw</option>
          <option value="cooked">cooked</option>
        </select>
        <button
          type="button"
          className="text-sm font-semibold text-primary-700"
          onClick={async () => {
            await updateLogEntry.mutateAsync({
              id: entry.id,
              meal: entry.meal,
              quantity: grams,
              enteredState: state,
              enteredGrams: grams,
            });
            setIsEditing(false);
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="text-sm text-stone-500"
          onClick={() => setIsEditing(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 border-t border-stone-100 px-3.5 py-2 first:border-t-0"
    >
      <FoodTile size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">{name}</p>
        <p className="text-[11.5px] text-stone-500">
          {entry.enteredGrams}g {entry.enteredState}
          {entry.isEstimated ? (
            <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              estimated
            </span>
          ) : null}
        </p>
      </div>
      <span className="text-[13px] font-bold text-stone-700">{Math.round(entry.calories)}</span>
      <button
        type="button"
        aria-label="Edit"
        onClick={() => setIsEditing(true)}
        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 active:scale-90"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={() => deleteLogEntry.mutate(entry.id)}
        className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 active:scale-90"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
}

const GROUP_NAME_MAX_CHARS = 42;

function AiMealRow({
  description,
  entries,
  date,
}: {
  description: string;
  entries: LogEntry[];
  date: string;
}) {
  const [showSheet, setShowSheet] = useState(false);
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const trimmedName =
    description.length > GROUP_NAME_MAX_CHARS
      ? description.slice(0, GROUP_NAME_MAX_CHARS - 1).trimEnd() + "…"
      : description;

  return (
    <>
      <motion.button
        type="button"
        layout
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setShowSheet(true)}
        className="flex w-full items-center gap-2.5 border-t border-stone-100 px-3.5 py-2 text-left first:border-t-0"
      >
        <FoodTile size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{trimmedName}</p>
          <p className="text-[11.5px] text-stone-500">
            {entries.length} ingredient{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-[13px] font-bold text-stone-700">{Math.round(totalCalories)}</span>
        <ChevronRight size={16} className="flex-shrink-0 text-stone-400" />
      </motion.button>

      {showSheet ? (
        <AiMealSheet
          description={description}
          entries={entries}
          date={date}
          onClose={() => setShowSheet(false)}
        />
      ) : null}
    </>
  );
}
