"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDishes } from "@/lib/meals/hooks";
import { computeDishNutrients } from "@/lib/meals/queries";
import type { Dish } from "@/lib/meals/types";
import { Button } from "@/components/ui/button";
import { LogDishSheet } from "@/components/meals/log-dish-sheet";

export default function MealsPage() {
  const router = useRouter();
  const { data: dishes = [], isLoading } = useDishes();
  const [loggingDish, setLoggingDish] = useState<Dish | null>(null);

  return (
    <main className="flex-1 px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">My meals</h1>
        <Link href="/meals/new">
          <Button>+ Add meal</Button>
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!isLoading && dishes.length === 0 ? (
        <p className="text-sm text-stone-500">
          No saved meals yet. Tap &ldquo;+ Add meal&rdquo; to build one from
          the catalog — search each ingredient, set its quantity, and the
          totals compute automatically.
        </p>
      ) : null}

      <ul>
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

  return (
    <li className="mb-2 rounded-xl border border-stone-200 shadow-sm transition-shadow hover:shadow-md p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{dish.name}</p>
          <p className="text-xs text-stone-500">
            {dish.ingredients.length} ingredients · {dish.servings} serving
            {dish.servings !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-600">
            {nutrients ? Math.round(nutrients.perServing.calories) : "—"} kcal/serving
          </span>
          <Link
            href={`/meals/${dish.id}/edit`}
            className="text-xs text-stone-500"
          >
            Edit
          </Link>
          <Button onClick={onLog}>Log</Button>
        </div>
      </div>
    </li>
  );
}
