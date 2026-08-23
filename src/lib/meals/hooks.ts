import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeMacrosForIngredients,
  createDish,
  deleteDish,
  fetchDish,
  fetchDishes,
  updateDish,
  type NewDishIngredient,
} from "./queries";

// Live running total as ingredients are added/edited in the builder —
// recomputed from the offline catalog cache on every change.
export function useIngredientMacros(ingredients: NewDishIngredient[]) {
  return useQuery({
    queryKey: ["ingredient-macros", ingredients],
    queryFn: () => computeMacrosForIngredients(ingredients),
  });
}

export function useDishes() {
  return useQuery({ queryKey: ["dishes"], queryFn: fetchDishes });
}

export function useDish(dishId: number | null) {
  return useQuery({
    queryKey: ["dish", dishId],
    queryFn: () => fetchDish(dishId!),
    enabled: dishId !== null,
  });
}

export function useCreateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      servings: number;
      ingredients: NewDishIngredient[];
    }) => createDish(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    },
  });
}

export function useUpdateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dishId,
      input,
    }: {
      dishId: number;
      input: { name: string; servings: number; ingredients: NewDishIngredient[] };
    }) => updateDish(dishId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      queryClient.invalidateQueries({ queryKey: ["dish", variables.dishId] });
    },
  });
}

export function useDeleteDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dishId: number) => deleteDish(dishId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    },
  });
}
