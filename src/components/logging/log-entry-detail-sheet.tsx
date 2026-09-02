"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoodTile } from "@/components/ui/food-tile";
import { useDeleteLogEntry, useUpdateLogEntry } from "@/lib/log/hooks";
import type { LogEntry } from "@/lib/log/types";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error";

// One shared detail view for anything logged, whatever the source — a
// single food from search/scan, a logged dish, or every ingredient of one
// AI "Describe what you ate" action (entries sharing an ai_group_id). Shows
// the macro total at top (the whole point: "click any logged item to see
// its macro information"), each entry with its own calories, an Edit
// toggle that turns grams into editable fields with a live preview before
// saving, and Delete for the whole thing — one entry or the whole group.
export function LogEntryDetailSheet({
  title,
  entries,
  date,
  onClose,
}: {
  title: string;
  entries: LogEntry[];
  date: string;
  onClose: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [grams, setGrams] = useState<Record<number, number>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, e.enteredGrams])),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateLogEntry = useUpdateLogEntry(date);
  const deleteLogEntry = useDeleteLogEntry(date);

  const groupId = entries[0]?.aiGroupId ?? null;

  // Nutrient amounts scale linearly with whatever the edit field actually
  // represents — which is NOT always e.grams (the raw-equivalent value):
  // a cooked food's e.grams already has the yield conversion baked in
  // while the field being edited is enteredGrams (what was typed, in
  // cooked terms), and a dish's e.grams is its raw-equivalent total while
  // enteredGrams holds the *serving count*. Dividing by e.enteredGrams
  // instead keeps numerator and denominator in the same unit for every
  // ref_type, matching what create_log_entry/update_log_entry do server-
  // side — done here client-side purely for an instant preview before
  // Save is pressed.
  const previewEntries = useMemo(
    () =>
      entries.map((e) => {
        const newGrams = grams[e.id] ?? e.enteredGrams;
        const ratio = e.enteredGrams > 0 ? newGrams / e.enteredGrams : 1;
        return {
          entry: e,
          grams: newGrams,
          calories: e.calories * ratio,
          protein: e.protein * ratio,
          carb: e.carb * ratio,
          fat: e.fat * ratio,
        };
      }),
    [entries, grams],
  );

  const totals = previewEntries.reduce(
    (sum, p) => ({
      calories: sum.calories + p.calories,
      protein: sum.protein + p.protein,
      carb: sum.carb + p.carb,
      fat: sum.fat + p.fat,
    }),
    { calories: 0, protein: 0, carb: 0, fat: 0 },
  );

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const changed = previewEntries.filter(
        (p) => p.grams !== p.entry.enteredGrams && p.grams > 0,
      );
      for (const p of changed) {
        await updateLogEntry.mutateAsync({
          id: p.entry.id,
          meal: p.entry.meal,
          quantity: p.grams,
          enteredState: p.entry.enteredState,
          enteredGrams: p.grams,
        });
      }
      setIsEditing(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const label = entries.length > 1 ? `"${title}" (${entries.length} items)` : `"${title}"`;
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setError(null);
    setIsDeleting(true);
    try {
      await Promise.all(entries.map((e) => deleteLogEntry.mutateAsync(e.id)));
      // The ai_meal_group row itself has no direct UI — clean it up once
      // every entry that referenced it is gone, so it doesn't linger as
      // orphaned metadata. Not critical if this part fails (RLS still
      // scopes it to this user, it's just unused rows), so no retry.
      if (groupId) {
        await createClient().from("ai_meal_group").delete().eq("id", groupId);
      }
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsDeleting(false);
    }
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              type="button"
              aria-label={isEditing ? "Done editing" : "Edit quantities"}
              onClick={() => setIsEditing((v) => !v)}
              className={
                "flex h-9 w-9 items-center justify-center rounded-full active:scale-90 " +
                (isEditing
                  ? "bg-primary-100 text-primary-700"
                  : "text-stone-400 hover:bg-stone-100 hover:text-stone-600")
              }
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              aria-label="Delete"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50 active:scale-90 disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-primary-50 py-2.5">
            <div className="text-base font-extrabold text-primary-700">
              {Math.round(totals.calories)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">kcal</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-protein-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-protein)" }}>
              {totals.protein.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">protein</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-carbs-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-carbs)" }}>
              {totals.carb.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">carb</div>
          </div>
          <div className="rounded-2xl py-2.5" style={{ backgroundColor: "var(--color-fat-bg)" }}>
            <div className="text-base font-extrabold" style={{ color: "var(--color-fat)" }}>
              {totals.fat.toFixed(1)}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-500">fat</div>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {entries.length} ingredient{entries.length !== 1 ? "s" : ""}
        </p>
        <ul className="mb-1">
          {previewEntries.map((p) => (
            <li
              key={p.entry.id}
              className="flex items-center gap-2.5 border-t border-stone-100 py-2 first:border-t-0"
            >
              <FoodTile size={34} />
              <span className="flex-1 truncate text-[13px] font-semibold">
                {p.entry.foodName ?? p.entry.dishName ?? "Unknown"}
              </span>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={grams[p.entry.id] ?? ""}
                    onChange={(e) =>
                      setGrams((prev) => ({
                        ...prev,
                        [p.entry.id]: Number(e.target.value) || 0,
                      }))
                    }
                    className="h-8 w-16 rounded-xl field-input text-center"
                  />
                  <span className="text-[10px] font-medium text-stone-400">
                    {p.entry.refType === "dish" ? "svg" : "g"}
                  </span>
                </div>
              ) : (
                <span className="text-[11.5px] text-stone-500">
                  {p.entry.refType === "dish"
                    ? `${p.grams} serving${p.grams !== 1 ? "s" : ""}`
                    : `${p.grams}g`}
                </span>
              )}
              <span className="w-12 flex-shrink-0 text-right text-[13px] font-bold text-stone-700">
                {Math.round(p.calories)}
              </span>
            </li>
          ))}
        </ul>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>
            Close
          </Button>
          {isEditing ? (
            <Button
              className="flex-1 rounded-2xl shadow-glow"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
