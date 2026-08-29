"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Play, Pencil, Trash2 } from "lucide-react";
import { useDeleteDish, useDishes } from "@/lib/meals/hooks";
import { computeDishNutrients } from "@/lib/meals/queries";
import type { Dish } from "@/lib/meals/types";
import { Button } from "@/components/ui/button";
import { FoodTile } from "@/components/ui/food-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { LogDishSheet } from "@/components/meals/log-dish-sheet";

export default function MealsPage() {
  const router = useRouter();
  const { data: dishes = [], isLoading } = useDishes();
  const [loggingDish, setLoggingDish] = useState<Dish | null>(null);

  return (
    <main className="flex-1 px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xl font-extrabold tracking-tight">My meals</p>
        <Link href="/meals/new">
          <Button className="gap-1.5 rounded-2xl shadow-glow">
            <Plus size={15} strokeWidth={2.6} />
            Add meal
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : null}

      {!isLoading && dishes.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-stone-500">
            No saved meals yet. Tap &ldquo;Add meal&rdquo; to build one from
            the catalog — search each ingredient, set its quantity, and the
            totals compute automatically.
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {dishes.map((dish) => (
          <DishRow key={dish.id} dish={dish} onLog={() => setLoggingDish(dish)} />
        ))}
      </ul>

      {loggingDish ? (
        <LogDishSheet
          dish={loggingDish}
          onClose={() => setLoggingDish(null)}
          onLogged={() => {
            setLoggingDish(null);
            router.push("/");
          }}
        />
      ) : null}
    </main>
  );
}

function DishRow({ dish, onLog }: { dish: Dish; onLog: () => void }) {
  const { data: nutrients } = useQuery({
    queryKey: ["dish-nutrients", dish.id, dish.ingredients],
    queryFn: () => computeDishNutrients(dish),
  });
  const deleteDish = useDeleteDish();

  function handleDelete() {
    if (!window.confirm(`Delete "${dish.name}"? This can't be undone.`)) return;
    deleteDish.mutate(dish.id);
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm">
      <FoodTile size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-bold">{dish.name}</p>
        <p className="text-[11.5px] text-stone-500">
          {dish.ingredients.length} ingredients · {dish.servings} serving
          {dish.servings !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="mr-0.5 text-right">
        <p className="text-[15px] font-extrabold text-primary-700">
          {nutrients ? Math.round(nutrients.perServing.calories) : "—"}
        </p>
        <p className="text-[9.5px] font-semibold text-stone-400">kcal</p>
      </div>
      <Link
        href={`/meals/${dish.id}/edit`}
        aria-label="Edit"
        className="rounded-xl p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 active:scale-90"
      >
        <Pencil size={15} />
      </Link>
      <button
        type="button"
        aria-label="Delete"
        onClick={handleDelete}
        disabled={deleteDish.isPending}
        className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 active:scale-90 disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
      <button
        type="button"
        aria-label="Log"
        onClick={onLog}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 active:scale-90"
      >
        <Play size={16} fill="currentColor" />
      </button>
    </li>
  );
}
