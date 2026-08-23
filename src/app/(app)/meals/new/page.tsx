"use client";

import { useRouter } from "next/navigation";
import { DishForm, type DishFormValue } from "@/components/meals/dish-form";
import { useCreateDish } from "@/lib/meals/hooks";

export default function NewMealPage() {
  const router = useRouter();
  const createDish = useCreateDish();

  async function handleSubmit(value: DishFormValue) {
    await createDish.mutateAsync({
      name: value.name,
      servings: value.servings,
      ingredients: value.ingredients.map((i) => ({
        foodId: i.foodId,
        grams: i.grams,
      })),
    });
    router.push("/meals");
  }

  return (
    <main className="flex-1 space-y-4 px-4 py-4">
      <h1 className="text-lg font-medium">New meal</h1>
      <DishForm
        initial={{ name: "", servings: 1, ingredients: [] }}
        submitLabel="Create"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/meals")}
        isSubmitting={createDish.isPending}
      />
    </main>
  );
}
