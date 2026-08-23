// Uses the browser's local time. profile.timezone (Phase 3) will make day
// boundaries explicit per CLAUDE.md's invariant; until then this is the
// closest available approximation for a single-device MVP.

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNowIso(): string {
  return new Date().toISOString();
}

export function shiftDateString(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const d = new Date(year!, (month ?? 1) - 1, day ?? 1);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatDateForDisplay(dateString: string): string {
  const today = getTodayDateString();
  if (dateString === today) return "Today";
  if (dateString === shiftDateString(today, -1)) return "Yesterday";
  if (dateString === shiftDateString(today, 1)) return "Tomorrow";
  const [year, month, day] = dateString.split("-").map(Number);
  const d = new Date(year!, (month ?? 1) - 1, day ?? 1);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Default meal slot by time of day, for the bottom-tab "Add" button when no
// slot is specified. Each meal section's own "add" link always passes an
// explicit slot, so this heuristic only matters for that one entry point.
export function defaultMealSlotForNow(): import("./log/types").MealSlot {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 12) return "morning_snack";
  if (hour >= 12 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "evening_snack";
  return "dinner";
}
