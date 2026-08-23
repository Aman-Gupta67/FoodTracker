"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { syncCatalogIfStale } from "@/lib/catalog/sync";
import { resolveFoodCandidates } from "@/lib/providers/resolve";
import { getFoodCandidateById } from "@/lib/providers/local-catalog-provider";
import type { FoodCandidate } from "@/lib/providers/types";
import { useFrequentFoods, useRecentFoods } from "@/lib/log/hooks";
import type { FoodShortcut } from "@/lib/log/queries";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/lib/log/types";
import { defaultMealSlotForNow, getTodayDateString } from "@/lib/date";
import { QuantitySheet } from "@/components/logging/quantity-sheet";
import { OffConfirmSheet } from "@/components/logging/off-confirm-sheet";
import { BarcodeScannerSheet } from "@/components/logging/barcode-scanner-sheet";
import { LogDishSheet } from "@/components/meals/log-dish-sheet";
import { useDishes } from "@/lib/meals/hooks";
import type { Dish } from "@/lib/meals/types";

const SEARCH_DEBOUNCE_MS = 150;

export function AddFoodClient({
  initialSlot,
}: {
  initialSlot: MealSlot | null;
}) {
  const router = useRouter();
  const [meal, setMeal] = useState<MealSlot>(
    () => initialSlot ?? defaultMealSlotForNow(),
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodCandidate[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodCandidate | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [confirmCandidate, setConfirmCandidate] = useState<FoodCandidate | null>(
    null,
  );
  const [showScanner, setShowScanner] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const date = getTodayDateString();

  const { data: dishes = [] } = useDishes();

  useEffect(() => {
    syncCatalogIfStale().catch(() => {
      // Offline reads still work against whatever's already cached;
      // surfacing a sync failure here would just block browsing.
    });
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    resolveFoodCandidates({ text: debouncedQuery }, controller.signal).then(
      (results) => {
        if (!controller.signal.aborted) setSearchResults(results);
      },
    );
    return () => controller.abort();
  }, [debouncedQuery]);

  const { data: recents = [] } = useRecentFoods(meal);
  const { data: frequents = [] } = useFrequentFoods(meal);

  const matchedDishes = debouncedQuery
    ? dishes.filter((d) =>
        d.name.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : [];

  async function openShortcut(shortcut: FoodShortcut) {
    const candidate = await getFoodCandidateById(shortcut.foodId);
    if (candidate) setSelectedFood(candidate);
  }

  // Shared by the text-search results list, scanner results, and typing a
  // barcode directly into the search box — anything not yet in the local
  // catalog (needsConfirmation) routes through OffConfirmSheet first.
  function selectFoodCandidate(food: FoodCandidate) {
    if (food.needsConfirmation) {
      setConfirmCandidate(food);
    } else {
      setSelectedFood(food);
    }
  }

  return (
    <main className="flex-1 px-4 py-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMeal(slot)}
            className={
              "rounded-full border px-3 py-1.5 text-sm " +
              (meal === slot
                ? "border-primary-500 bg-primary-100 text-primary-700"
                : "border-stone-300 text-stone-700")
            }
          >
            {MEAL_SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      {recents.length > 0 && !debouncedQuery ? (
        <FoodShortcutList
          title="Recents"
          items={recents}
          onSelect={openShortcut}
        />
      ) : null}

      {frequents.length > 0 && !debouncedQuery ? (
        <FoodShortcutList
          title="Frequent"
          items={frequents}
          onSelect={openShortcut}
        />
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search foods…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 flex-1 field-input"
        />
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          aria-label="Scan a barcode"
          className="text-stone-400 hover:text-stone-600"
        >
          <ScanBarcode size={22} />
        </button>
      </div>

      {notFoundBarcode ? (
        <p className="mb-4 rounded-md border border-stone-300 bg-stone-50 p-3 text-sm text-stone-600">
          No product found for barcode {notFoundBarcode} on Open Food Facts.{" "}
          <button
            type="button"
            className="text-primary-700 underline"
            onClick={() => setNotFoundBarcode(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {debouncedQuery ? (
        <ul>
          {matchedDishes.map((dish) => (
            <li key={`dish-${dish.id}`}>
              <button
                type="button"
                onClick={() => setSelectedDish(dish)}
                className="flex w-full items-center justify-between border-b border-stone-100 py-3 text-left text-sm"
              >
                <span>
                  {dish.name}{" "}
                  <span className="text-xs text-primary-700">meal</span>
                </span>
                <span className="text-stone-400">
                  {dish.ingredients.length} ingredients
                </span>
              </button>
            </li>
          ))}
          {searchResults.map((food) => (
            <li key={food.id ?? `off-${food.provenance.sourceRef}`}>
              <button
                type="button"
                onClick={() => selectFoodCandidate(food)}
                className="flex w-full items-center justify-between border-b border-stone-100 py-3 text-left text-sm"
              >
                <span>
                  {food.name}{" "}
                  {food.needsConfirmation ? (
                    <span className="text-xs text-primary-700">new</span>
                  ) : null}
                </span>
                <span className="text-stone-400">
                  {food.nutrients.energy?.toFixed(0) ?? "—"} kcal/100g
                </span>
              </button>
            </li>
          ))}
          {searchResults.length === 0 && matchedDishes.length === 0 ? (
            <p className="py-3 text-sm text-stone-500">No matches.</p>
          ) : null}
        </ul>
      ) : null}

      {selectedFood ? (
        <QuantitySheet
          food={selectedFood}
          meal={meal}
          date={date}
          onClose={() => setSelectedFood(null)}
          onLogged={() => {
            setSelectedFood(null);
            router.push("/");
          }}
        />
      ) : null}

      {selectedDish ? (
        <LogDishSheet
          dish={selectedDish}
          initialMeal={meal}
          onClose={() => setSelectedDish(null)}
          onLogged={() => {
            setSelectedDish(null);
            router.push("/");
          }}
        />
      ) : null}

      {confirmCandidate ? (
        <OffConfirmSheet
          candidate={confirmCandidate}
          onConfirmed={(confirmed) => {
            setConfirmCandidate(null);
            setSelectedFood(confirmed);
          }}
          onCancel={() => setConfirmCandidate(null)}
        />
      ) : null}

      {showScanner ? (
        <BarcodeScannerSheet
          onResolved={(candidate) => {
            setShowScanner(false);
            selectFoodCandidate(candidate);
          }}
          onNotFound={(barcode) => {
            setShowScanner(false);
            setNotFoundBarcode(barcode);
          }}
          onClose={() => setShowScanner(false)}
        />
      ) : null}
    </main>
  );
}

function FoodShortcutList({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: FoodShortcut[];
  onSelect: (item: FoodShortcut) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
        {title}
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.foodId}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full border-b border-stone-100 py-2 text-left text-sm"
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
