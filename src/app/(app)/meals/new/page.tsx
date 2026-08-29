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
      <p className="text-xl font-extrabold tracking-tight">New meal</p>
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
