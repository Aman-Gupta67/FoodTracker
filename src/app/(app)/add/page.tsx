import { AddFoodClient } from "./add-food-client";
import type { MealSlot } from "@/lib/log/types";
import { MEAL_SLOTS } from "@/lib/log/types";

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; scan?: string }>;
}) {
  const { slot, scan } = await searchParams;
  const initialSlot = MEAL_SLOTS.includes(slot as MealSlot)
    ? (slot as MealSlot)
    : null;

  return <AddFoodClient initialSlot={initialSlot} autoOpenScanner={scan === "1"} />;
}
