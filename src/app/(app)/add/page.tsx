import { AddFoodClient } from "./add-food-client";
import type { MealSlot } from "@/lib/log/types";
import { MEAL_SLOTS } from "@/lib/log/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; scan?: string; date?: string }>;
}) {
  const { slot, scan, date } = await searchParams;
  const initialSlot = MEAL_SLOTS.includes(slot as MealSlot)
    ? (slot as MealSlot)
    : null;
  // Home passes the day the user was actually viewing (WeekStrip's
  // selection) — without this, everything logged from here always landed
  // on today regardless of which day the FAB/"+ Add to X" was tapped from.
  const initialDate = date && DATE_PATTERN.test(date) ? date : null;

  return (
    <AddFoodClient
      initialSlot={initialSlot}
      autoOpenScanner={scan === "1"}
      initialDate={initialDate}
    />
  );
}
