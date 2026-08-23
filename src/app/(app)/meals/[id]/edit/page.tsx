"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { DishForm, type DishFormValue } from "@/components/meals/dish-form";
import { useDeleteDish, useDish, useUpdateDish } from "@/lib/meals/hooks";

export default function EditDishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const dishId = Number(id);
  const router = useRouter();
  const { data: dish, isLoading } = useDish(dishId);
  const updateDish = useUpdateDish();
  const deleteDish = useDeleteDish();

  async function handleSubmit(value: DishFormValue) {
    await updateDish.mutateAsync({
      dishId,
      input: {
        name: value.name,
        servings: value.servings,
        ingredients: value.ingredients.map((i) => ({
          foodId: i.foodId,
          grams: i.grams,
        })),
      },
    });
    router.push("/meals");
  }

  async function handleDelete() {
    await deleteDish.mutateAsync(dishId);
    router.push("/meals");
  }

  if (isLoading) {
    return (
      <main className="flex-1 px-4 py-4">
        <p className="text-sm text-stone-500">Loading…</p>
      </main>
    );
  }

  if (!dish) {
    return (
      <main className="flex-1 px-4 py-4">
        <p className="text-sm text-stone-500">Meal not found.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-4 px-4 py-4">
      <h1 className="text-lg font-medium">Edit meal</h1>
      <DishForm
        initial={{
          name: dish.name,
          servings: dish.servings,
          ingredients: dish.ingredients.map((i) => ({
            foodId: i.foodId,
            foodName: i.foodName,
            grams: i.grams,
          })),
        }}
        submitLabel="Save"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/meals")}
        onDelete={handleDelete}
        isSubmitting={updateDish.isPending}
      />
    </main>
  );
}
