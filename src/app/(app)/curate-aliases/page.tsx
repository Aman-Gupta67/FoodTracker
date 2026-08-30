"use client";

import { useEffect, useState } from "react";
import { searchFoodByAlias, type FoodSearchResult } from "@/lib/catalog/search";
import { getFoodAliases } from "@/lib/catalog/food-detail";
import { useAddFoodAliases } from "@/lib/ai/add-food-aliases";
import { fetchJsonWithRetry } from "@/lib/ai/fetch-json";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error";

const SEARCH_DEBOUNCE_MS = 150;

export default function CurateAliasesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [existingAliases, setExistingAliases] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const addFoodAliases = useAddFoodAliases();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    searchFoodByAlias(debouncedQuery).then(setResults);
  }, [debouncedQuery]);

  async function selectFood(food: FoodSearchResult) {
    setSelected(food);
    setSuggestions([]);
    setApproved(new Set());
    setSaved(false);
    setError(null);
    setExistingAliases(await getFoodAliases(food.foodId));
  }

  async function handleSuggest() {
    if (!selected) return;
    setIsSuggesting(true);
    setError(null);
    try {
      const { res, body } = await fetchJsonWithRetry("/api/ai/suggest-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: selected.name,
          existingAliases,
        }),
      });
      if (!res.ok) {
        throw new Error(
          (body as { error?: string })?.error ?? "Could not get suggestions.",
        );
      }
      const aliases = (body as { aliases: string[] }).aliases;
      setSuggestions(aliases);
      setApproved(new Set(aliases)); // pre-checked, reviewable before saving
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSuggesting(false);
    }
  }

  function toggleApproved(alias: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });
  }

  async function handleSave() {
    if (!selected || approved.size === 0) return;
    setError(null);
    try {
      await addFoodAliases.mutateAsync({
        foodId: selected.foodId,
        aliases: [...approved],
      });
      setExistingAliases((prev) => [...prev, ...approved]);
      setSuggestions((prev) => prev.filter((s) => !approved.has(s)));
      setApproved(new Set());
      setSaved(true);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <main className="flex-1 space-y-4 px-4 py-4">
      <h1 className="text-lg font-medium">Curate aliases</h1>
      <p className="text-sm text-stone-500">
        Search a food, then ask the AI to suggest search terms people might
        actually type — you approve or reject each one before it&apos;s saved.
      </p>

      <input
        type="text"
        placeholder="Search a food…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 w-full field-input"
      />

      {debouncedQuery && !selected ? (
        <ul className="rounded-md border border-stone-200">
          {results.map((food) => (
            <li key={food.foodId}>
              <button
                type="button"
                onClick={() => selectFood(food)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
              >
                {food.name}
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-500">No matches.</p>
          ) : null}
        </ul>
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{selected.name}</h2>
            <button
              type="button"
              className="text-xs text-stone-500"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
            >
              Change
            </button>
          </div>

          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
            Existing aliases
          </p>
          <p className="mb-4 text-sm text-stone-600">
            {existingAliases.length > 0 ? existingAliases.join(", ") : "None yet"}
          </p>

          <Button onClick={handleSuggest} disabled={isSuggesting}>
            {isSuggesting ? "Thinking…" : "Suggest more aliases"}
          </Button>

          {suggestions.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                Suggestions — uncheck any you don&apos;t want
              </p>
              <ul className="mb-4 space-y-1">
                {suggestions.map((alias) => (
                  <li key={alias} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={approved.has(alias)}
                      onChange={() => toggleApproved(alias)}
                      className="h-4 w-4"
                    />
                    <span>{alias}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={handleSave}
                disabled={approved.size === 0 || addFoodAliases.isPending}
              >
                {addFoodAliases.isPending
                  ? "Saving…"
                  : `Add ${approved.size} alias${approved.size === 1 ? "" : "es"}`}
              </Button>
            </div>
          ) : null}

          {saved ? (
            <p className="mt-3 text-sm text-primary-700">Saved.</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </main>
  );
}
