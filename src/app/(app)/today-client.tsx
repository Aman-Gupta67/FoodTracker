"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useDeleteLogEntry,
  useLogEntries,
  useUpdateLogEntry,
} from "@/lib/log/hooks";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type LogEntry, type MealSlot } from "@/lib/log/types";
import {
  formatDateForDisplay,
  getTodayDateString,
  shiftDateString,
} from "@/lib/date";
import { useDailyTargets } from "@/lib/profile/hooks";
import { CalorieRing } from "@/components/kpi/calorie-ring";
import { MacroBar } from "@/components/kpi/macro-bar";

export function TodayClient({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState(initialDate ?? getTodayDateString());
  const { data: entries = [], isLoading } = useLogEntries(date);
  const { data: targets } = useDailyTargets();

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
      <DateStrip date={date} onChange={setDate} />

      {targets ? (
        <div className="mb-4 flex items-center gap-4">
          <CalorieRing consumed={dayTotal} target={targets.calorieTarget} />
          <div className="flex-1 space-y-2">
            <MacroBar
              label="Protein"
              consumed={proteinTotal}
              target={targets.proteinG}
              color="var(--color-protein)"
            />
            <MacroBar
              label="Carbs"
              consumed={carbTotal}
              target={targets.carbG}
              color="var(--color-carbs)"
            />
            <MacroBar
              label="Fat"
              consumed={fatTotal}
              target={targets.fatG}
              color="var(--color-fat)"
            />
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-2xl font-medium">{Math.round(dayTotal)} kcal</p>
          <Link href="/profile" className="text-xs text-primary-700">
            Set up your profile to see a target →
          </Link>
        </div>
      )}

      {entries.length > 0 && estimatedCount > 0 ? (
        <p className="mb-4 text-xs text-stone-500">
          {estimatedCount} of {entries.length} entr
          {entries.length === 1 ? "y" : "ies"} estimated
          {estimatedCount / entries.length > 0.5 ? " — take today's total with a grain of salt" : ""}
        </p>
      ) : null}

      {isLoading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!isLoading && entries.length === 0 ? (
        <EmptyDay date={date} />
      ) : (
        MEAL_SLOTS.map((slot) => (
          <MealSection key={slot} slot={slot} entries={byMeal.get(slot) ?? []} date={date} />
        ))
      )}
    </main>
  );
}

function DateStrip({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(shiftDateString(date, -1))}
        className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
      >
        <ChevronLeft size={20} />
      </button>

      <label className="relative flex cursor-pointer items-center gap-1">
        <span className="text-sm font-medium text-stone-900">
          {formatDateForDisplay(date)}
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(shiftDateString(date, 1))}
        className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function EmptyDay({ date }: { date: string }) {
  const isToday = date === getTodayDateString();
  return (
    <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center">
      <p className="text-sm text-stone-500">
        {isToday ? "Nothing logged yet today." : "Nothing logged this day."}
      </p>
      {isToday ? (
        <Link href="/add" className="mt-2 inline-block text-sm text-primary-700">
          + Log your first item
        </Link>
      ) : null}
    </div>
  );
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

  return (
    <section className="mb-4 rounded-xl border border-stone-200 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <span className="text-sm font-medium">{MEAL_SLOT_LABELS[slot]}</span>
        <span className="text-xs text-stone-500">{Math.round(subtotal)} kcal</span>
      </div>

      {entries.length === 0 ? (
        <Link
          href={`/add?slot=${slot}`}
          className="block px-3 py-2 text-sm text-primary-700"
        >
          + Add
        </Link>
      ) : (
        <>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} date={date} />
          ))}
          <Link
            href={`/add?slot=${slot}`}
            className="block px-3 py-2 text-sm text-primary-700"
          >
            + Add
          </Link>
        </>
      )}
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

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2">
        <input
          type="number"
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
          className="text-sm text-primary-700"
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
    <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2 text-sm">
      <div>
        <p>{name}</p>
        <p className="text-xs text-stone-500">
          {entry.enteredGrams} g {entry.enteredState}
          {entry.isEstimated ? (
            <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
              estimated
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-stone-600">{Math.round(entry.calories)} kcal</span>
        <button
          type="button"
          className="text-xs text-stone-500"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs text-red-600"
          onClick={() => deleteLogEntry.mutate(entry.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
