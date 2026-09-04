"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ScanBarcode, Sparkles, Shuffle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { syncCatalogIfStale } from "@/lib/catalog/sync";
import { resolveFoodCandidates } from "@/lib/providers/resolve";
import { getFoodCandidateById } from "@/lib/providers/local-catalog-provider";
import type { FoodCandidate } from "@/lib/providers/types";
import { useFrequentFoods, useRecentFoods } from "@/lib/log/hooks";
import type { FoodShortcut } from "@/lib/log/queries";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/lib/log/types";
import { defaultMealSlotForNow, getNowIso, getTodayDateString } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { FoodTile } from "@/components/ui/food-tile";
import { QuantitySheet } from "@/components/logging/quantity-sheet";
import { OffConfirmSheet } from "@/components/logging/off-confirm-sheet";
import { BarcodeScannerSheet } from "@/components/logging/barcode-scanner-sheet";
import { SaveAsDishSheet } from "@/components/logging/save-as-dish-sheet";
import { LogDishSheet } from "@/components/meals/log-dish-sheet";
import { useDishes, useCreateDish } from "@/lib/meals/hooks";
import type { Dish } from "@/lib/meals/types";
import {
  resolveParsedItems,
  type ParsedMealItem,
  type ResolvedMealItem,
} from "@/lib/ai/resolve-parsed-items";
import { fetchJsonWithRetry } from "@/lib/ai/fetch-json";
import { requestMealSuggestion } from "@/lib/ai/suggest-meal-client";
import { useConfirmLlmFoodsBulk } from "@/lib/ai/confirm-llm-food";
import { getErrorMessage } from "@/lib/error";
import { useCreateLogEntriesBulk, useLogEntries } from "@/lib/log/hooks";
import { useDailyTargets } from "@/lib/profile/hooks";

const SEARCH_DEBOUNCE_MS = 150;

export function AddFoodClient({
  initialSlot,
  autoOpenScanner = false,
  initialDate = null,
}: {
  initialSlot: MealSlot | null;
  autoOpenScanner?: boolean;
  initialDate?: string | null;
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
  const [showScanner, setShowScanner] = useState(autoOpenScanner);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [mealDescription, setMealDescription] = useState("");
  const [isParsingMeal, setIsParsingMeal] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<ResolvedMealItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [showAddMissedItem, setShowAddMissedItem] = useState(false);
  const [missedItemQuery, setMissedItemQuery] = useState("");
  const [missedItemResults, setMissedItemResults] = useState<FoodCandidate[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestReasoning, setSuggestReasoning] = useState<string | null>(null);
  const [isLoggingAll, setIsLoggingAll] = useState(false);
  const [logAllError, setLogAllError] = useState<string | null>(null);
  const [showSaveAsDish, setShowSaveAsDish] = useState(false);
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [saveDishError, setSaveDishError] = useState<string | null>(null);
  // The day Home's WeekStrip had selected when "+ Add" was tapped — logging
  // for a past date must land on that date, not silently fall back to
  // today just because this screen doesn't otherwise track which day it's
  // for.
  const date = initialDate ?? getTodayDateString();

  const { data: dishes = [] } = useDishes();
  const { data: targets } = useDailyTargets();
  const { data: todayEntries = [] } = useLogEntries(date);
  const confirmLlmFoodsBulk = useConfirmLlmFoodsBulk();
  const createLogEntriesBulk = useCreateLogEntriesBulk(date);
  const createDish = useCreateDish();

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

  async function handleParseMeal() {
    if (!mealDescription.trim()) return;
    setIsParsingMeal(true);
    setParseError(null);
    try {
      const { res, body } = await fetchJsonWithRetry("/api/ai/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mealDescription }),
      });
      if (!res.ok) {
        throw new Error((body as { error?: string })?.error ?? "Could not parse that.");
      }
      const resolved = await resolveParsedItems((body as { items: ParsedMealItem[] }).items);
      setPendingItems(resolved);
    } catch (e) {
      setParseError(getErrorMessage(e));
    } finally {
      setIsParsingMeal(false);
    }
  }

  function removePendingItem(index: number) {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePendingItemGrams(index: number, grams: number) {
    setPendingItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, grams } : item)),
    );
  }

  function addMissedItem(candidate: FoodCandidate) {
    setPendingItems((prev) => [...prev, { candidate, grams: 100 }]);
    setShowAddMissedItem(false);
    setMissedItemQuery("");
    setMissedItemResults([]);
  }

  useEffect(() => {
    if (!showAddMissedItem || !missedItemQuery.trim()) {
      setMissedItemResults([]);
      return;
    }
    const controller = new AbortController();
    resolveFoodCandidates({ text: missedItemQuery }, controller.signal).then(
      (results) => {
        if (!controller.signal.aborted) setMissedItemResults(results);
      },
    );
    return () => controller.abort();
  }, [missedItemQuery, showAddMissedItem]);

  async function handleSuggestMeal() {
    if (!targets) return;
    setIsSuggesting(true);
    setSuggestError(null);
    setSuggestReasoning(null);
    try {
      const consumed = todayEntries.reduce(
        (sum, e) => ({
          calories: sum.calories + e.calories,
          protein: sum.protein + e.protein,
          carb: sum.carb + e.carb,
          fat: sum.fat + e.fat,
        }),
        { calories: 0, protein: 0, carb: 0, fat: 0 },
      );
      const remaining = {
        calories: Math.max(0, targets.calorieTarget - consumed.calories),
        protein: Math.max(0, targets.proteinG - consumed.protein),
        carb: Math.max(0, targets.carbG - consumed.carb),
        fat: Math.max(0, targets.fatG - consumed.fat),
      };
      const consumedToday = {
        totals: consumed,
        items: todayEntries.map((e) => ({
          name: e.foodName ?? e.dishName ?? "Unknown",
          grams: e.grams,
          meal: e.meal,
        })),
      };
      const { items, reasoning } = await requestMealSuggestion(
        remaining,
        consumedToday,
      );
      setPendingItems(items);
      setSuggestReasoning(reasoning);
    } catch (e) {
      setSuggestError(getErrorMessage(e));
    } finally {
      setIsSuggesting(false);
    }
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

  const pendingTotals = pendingItems.reduce(
    (sum, item) => {
      const factor = item.grams / 100;
      return {
        calories: sum.calories + (item.candidate.nutrients.energy ?? 0) * factor,
        protein: sum.protein + (item.candidate.nutrients.protein ?? 0) * factor,
        carb: sum.carb + (item.candidate.nutrients.carb ?? 0) * factor,
        fat: sum.fat + (item.candidate.nutrients.fat ?? 0) * factor,
      };
    },
    { calories: 0, protein: 0, carb: 0, fat: 0 },
  );

  // Shared by "Log this" and "Add to Eat List": resolves every pending
  // item's foodId in ONE round trip (confirm_llm_foods_bulk) instead of one
  // RPC call per AI-estimated item — items that are already real catalog
  // matches (candidate.id set) skip confirmation entirely. Idempotent per
  // food, so calling it again after a later failure elsewhere is safe.
  async function resolveAllFoodIds(items: ResolvedMealItem[]): Promise<number[]> {
    const needsConfirm = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !item.candidate.id);

    const resolved = new Map<number, number>();
    if (needsConfirm.length > 0) {
      const confirmed = await confirmLlmFoodsBulk.mutateAsync(
        needsConfirm.map(({ item, idx }) => ({ idx, candidate: item.candidate })),
      );
      confirmed.forEach((foodId, idx) => resolved.set(idx, foodId));
    }
    return items.map((item, idx) =>
      item.candidate.id ? Number(item.candidate.id) : resolved.get(idx)!,
    );
  }

  async function handleLogAllPending() {
    if (pendingItems.length === 0) return;
    setIsLoggingAll(true);
    setLogAllError(null);
    try {
      const foodIds = await resolveAllFoodIds(pendingItems);
      const consumedAt = getNowIso();
      await createLogEntriesBulk.mutateAsync({
        entries: pendingItems.map((item, idx) => ({
          foodId: foodIds[idx]!,
          portionId: null,
          quantity: item.grams,
          enteredState: "raw",
          enteredGrams: item.grams,
          consumedAt,
          consumedDate: date,
          meal,
        })),
        description: mealDescription.trim() || suggestReasoning || "Multiple items",
      });
      setPendingItems([]);
      router.push("/");
    } catch (e) {
      setLogAllError(getErrorMessage(e));
    } finally {
      setIsLoggingAll(false);
    }
  }

  async function handleSaveAsDish(name: string) {
    setIsSavingDish(true);
    setSaveDishError(null);
    try {
      const foodIds = await resolveAllFoodIds(pendingItems);
      const ingredients = pendingItems.map((item, idx) => ({
        foodId: foodIds[idx]!,
        grams: item.grams,
      }));
      await createDish.mutateAsync({ name, servings: 1, ingredients });
      setPendingItems([]);
      setShowSaveAsDish(false);
    } catch (e) {
      setSaveDishError(getErrorMessage(e));
    } finally {
      setIsSavingDish(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-4">
      <p className="mb-3 text-xl font-extrabold tracking-tight">Add food</p>

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMeal(slot)}
            className={
              "flex-shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors " +
              (meal === slot
                ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-glow"
                : "border-[1.5px] border-stone-200 text-stone-600")
            }
          >
            {MEAL_SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      <div className="mb-3.5 rounded-[22px] bg-white p-4 shadow-md">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Sparkles size={16} className="text-primary-600" />
          <span className="text-[13.5px] font-bold text-stone-800">
            Describe what you ate
          </span>
        </div>
        <textarea
          rows={2}
          placeholder="e.g. 2 rotis, a bowl of chole, and a glass of buttermilk"
          value={mealDescription}
          onChange={(e) => setMealDescription(e.target.value)}
          className="field-input mb-2.5 w-full resize-none rounded-[14px] py-3"
        />
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 rounded-[13px] shadow-glow"
            onClick={handleParseMeal}
            disabled={isParsingMeal || !mealDescription.trim()}
          >
            {isParsingMeal ? "Thinking…" : "Analyze meal"}
          </Button>
          {targets ? (
            <Button
              variant="outline"
              className="flex-1 gap-1.5 rounded-[13px]"
              onClick={handleSuggestMeal}
              disabled={isSuggesting}
            >
              <Shuffle size={14} />
              {isSuggesting ? "Thinking…" : "Suggest a meal"}
            </Button>
          ) : null}
        </div>
        {parseError ? (
          <p className="mt-2 text-sm text-red-600">{parseError}</p>
        ) : null}
        {suggestError ? (
          <p className="mt-2 text-sm text-red-600">{suggestError}</p>
        ) : null}
        {suggestReasoning ? (
          <p className="mt-2 text-xs text-stone-500">{suggestReasoning}</p>
        ) : null}

        {pendingItems.length > 0 ? (
          <div className="mt-3.5 border-t border-stone-100 pt-3.5">
            <div className="mb-2.5 grid grid-cols-4 gap-1.5 rounded-2xl bg-stone-50 p-2.5 text-center text-xs">
              <div>
                <div className="text-[15px] font-extrabold text-primary-700">
                  {pendingTotals.calories.toFixed(0)}
                </div>
                <div className="text-[9.5px] font-semibold text-stone-500">kcal</div>
              </div>
              <div>
                <div
                  className="text-[15px] font-extrabold"
                  style={{ color: "var(--color-protein)" }}
                >
                  {pendingTotals.protein.toFixed(1)}
                </div>
                <div className="text-[9.5px] font-semibold text-stone-500">protein</div>
              </div>
              <div>
                <div
                  className="text-[15px] font-extrabold"
                  style={{ color: "var(--color-carbs)" }}
                >
                  {pendingTotals.carb.toFixed(1)}
                </div>
                <div className="text-[9.5px] font-semibold text-stone-500">carb</div>
              </div>
              <div>
                <div
                  className="text-[15px] font-extrabold"
                  style={{ color: "var(--color-fat)" }}
                >
                  {pendingTotals.fat.toFixed(1)}
                </div>
                <div className="text-[9.5px] font-semibold text-stone-500">fat</div>
              </div>
            </div>

            <div className="mb-2 flex gap-2">
              <Button
                className="flex-1 rounded-xl"
                onClick={handleLogAllPending}
                disabled={isLoggingAll || confirmLlmFoodsBulk.isPending}
              >
                {isLoggingAll ? "Logging…" : "Log this"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowSaveAsDish(true)}
                disabled={isLoggingAll}
              >
                Add to Eat List
              </Button>
            </div>
            {logAllError ? (
              <p className="mb-2 text-sm text-red-600">{logAllError}</p>
            ) : null}

            <ul>
              <AnimatePresence initial={false}>
              {pendingItems.map((item, i) => {
                const kcal =
                  ((item.candidate.nutrients.energy ?? 0) * item.grams) / 100;
                return (
                  <motion.li
                    key={`${item.candidate.name}-${i}`}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.03 }}
                    className="flex items-center gap-2.5 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveItemIndex(i)}
                      className="flex flex-1 items-center gap-2.5 text-left"
                    >
                      <FoodTile size={34} />
                      <span className="text-[13px] font-semibold">
                        {item.candidate.name}{" "}
                        <span className="text-[11px] font-normal text-stone-500">
                          ~{item.grams.toFixed(0)}g · {Math.round(kcal)} kcal
                        </span>
                        {item.candidate.needsConfirmation ? (
                          <span className="ml-1.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-700">
                            AI est.
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removePendingItem(i)}
                      className="rounded-lg p-1 text-stone-400 active:scale-90"
                    >
                      <X size={15} />
                    </button>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </ul>

            {showAddMissedItem ? (
              <div className="mt-1 rounded-2xl bg-stone-50 p-2.5">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search for what's missing…"
                  value={missedItemQuery}
                  onChange={(e) => setMissedItemQuery(e.target.value)}
                  className="h-10 w-full rounded-xl field-input"
                />
                {missedItemResults.length > 0 ? (
                  <ul className="mt-1.5 overflow-hidden rounded-xl bg-white">
                    {missedItemResults.map((food) => (
                      <li key={food.id ?? `off-${food.provenance.sourceRef}`}>
                        <button
                          type="button"
                          onClick={() => addMissedItem(food)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium hover:bg-stone-50"
                        >
                          <FoodTile size={28} />
                          {food.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="mt-1.5 text-xs font-semibold text-stone-500"
                  onClick={() => {
                    setShowAddMissedItem(false);
                    setMissedItemQuery("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMissedItem(true)}
                className="mt-1 w-full rounded-xl border border-dashed border-stone-300 py-2 text-[12.5px] font-bold text-stone-500"
              >
                + Add item AI missed
              </button>
            )}
          </div>
        ) : null}
      </div>

      {recents.length > 0 && !debouncedQuery ? (
        <FoodShortcutList title="Recents" items={recents} onSelect={openShortcut} />
      ) : null}

      {frequents.length > 0 && !debouncedQuery ? (
        <FoodShortcutList title="Frequent" items={frequents} onSelect={openShortcut} />
      ) : null}

      <div className="mb-3 flex gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-white px-3.5 shadow-sm">
          <Search size={18} className="text-stone-400" />
          <input
            type="text"
            placeholder="Search foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-full flex-1 border-none bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          aria-label="Scan a barcode"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 px-4 text-white shadow-glow active:scale-95"
        >
          <ScanBarcode size={18} />
          <span className="text-[12.5px] font-bold">Scan</span>
        </button>
      </div>

      {notFoundBarcode ? (
        <p className="mb-4 rounded-2xl bg-white p-3 text-sm text-stone-600 shadow-sm">
          No product found for barcode {notFoundBarcode} on Open Food Facts.{" "}
          <button
            type="button"
            className="font-semibold text-primary-700 underline"
            onClick={() => setNotFoundBarcode(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {debouncedQuery ? (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {matchedDishes.map((dish) => (
            <li key={`dish-${dish.id}`} className="border-b border-stone-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setSelectedDish(dish)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
              >
                <FoodTile size={34} />
                <span className="flex-1 text-[13.5px] font-semibold">
                  {dish.name}{" "}
                  <span className="text-[11px] font-bold text-primary-700">meal</span>
                </span>
                <span className="text-xs text-stone-400">
                  {dish.ingredients.length} ingredients
                </span>
              </button>
            </li>
          ))}
          {searchResults.map((food) => (
            <li
              key={food.id ?? `off-${food.provenance.sourceRef}`}
              className="border-b border-stone-100 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => selectFoodCandidate(food)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
              >
                <FoodTile size={34} />
                <span className="flex-1 text-[13.5px] font-semibold">
                  {food.name}{" "}
                  {food.needsConfirmation ? (
                    <span className="text-[11px] font-bold text-primary-700">new</span>
                  ) : null}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  {food.nutrients.energy?.toFixed(0) ?? "—"} kcal/100g
                </span>
              </button>
            </li>
          ))}
          {searchResults.length === 0 && matchedDishes.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-stone-500">No matches.</p>
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

      {activeItemIndex !== null && pendingItems[activeItemIndex] ? (
        <QuantitySheet
          food={pendingItems[activeItemIndex]!.candidate}
          meal={meal}
          date={date}
          initialGrams={pendingItems[activeItemIndex]!.grams}
          onClose={() => setActiveItemIndex(null)}
          onSaveQuantity={(grams) => updatePendingItemGrams(activeItemIndex, grams)}
          onLogged={() => setActiveItemIndex(null)}
        />
      ) : null}

      {selectedDish ? (
        <LogDishSheet
          dish={selectedDish}
          initialMeal={meal}
          date={date}
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

      {showSaveAsDish ? (
        <SaveAsDishSheet
          suggestedName={mealDescription.trim().slice(0, 40) || "AI meal"}
          isSaving={isSavingDish}
          error={saveDishError}
          onSave={handleSaveAsDish}
          onCancel={() => {
            setShowSaveAsDish(false);
            setSaveDishError(null);
          }}
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
    <div className="mb-3.5">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
        {title}
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-0.5">
        {items.map((item) => (
          <button
            key={item.foodId}
            type="button"
            onClick={() => onSelect(item)}
            className="w-[84px] flex-shrink-0 rounded-2xl bg-white p-2.5 text-center shadow-sm"
          >
            <div className="mx-auto mb-1.5 flex justify-center">
              <FoodTile size={36} />
            </div>
            <p className="truncate text-[11px] font-semibold">{item.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
