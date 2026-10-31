import { z } from "zod";
import type { PortalContentInput } from "./portal-content.js";
export const MAX_DIET_OPTIONS = 3;
export function dietOptionName(mealName: string, index: number) {
  return `${mealName.trim()} ${String.fromCharCode(65 + index)}`;
}
export type DietContent = Extract<PortalContentInput, { kind: "diet" }>;
export type DietItem = DietContent["data"]["meals"][number]["items"][number];
export type DietMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type DietOption = {
  name: string;
  items: DietItem[];
  macros: DietMacros;
};
export type DietView = {
  id: string;
  name: string;
  authorName: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  objective: string;
  notes: string;
  meals: { name: string; time: string | null; options: DietOption[] }[];
  dailyRange: { min: DietMacros; max: DietMacros };
};
export const dietMealInputSchema = z.strictObject({
  assignmentId: z.uuid(),
  mealIndex: z.number().int().min(0).max(11),
  optionIndex: z.number().int().min(0).max(MAX_DIET_OPTIONS - 1),
  quantities: z.array(z.number().positive().max(100000)).min(1).max(30),
  date: z.string().date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  requestId: z.uuid(),
});
export type DietMealInput = z.infer<typeof dietMealInputSchema>;
export function dietMacros(
  items: DietItem[],
  quantities = items.map((item) => item.quantity),
): DietMacros {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const [itemIndex, item] of items.entries())
    for (const key of ["calories", "protein", "carbs", "fat"] as const)
      total[key] +=
        (item.food[key] * quantities[itemIndex]) / item.food.servingAmount;
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [
      key,
      Math.round(value * 1000) / 1000,
    ]),
  ) as DietMacros;
}
export function dietMealOptions(
  meal: DietContent["data"]["meals"][number],
): DietOption[] {
  return [
    { name: "Opção principal", items: meal.items },
    ...(meal.options || []),
  ].slice(0, MAX_DIET_OPTIONS).map((option, index) => ({ ...option, name: dietOptionName(meal.name, index), macros: dietMacros(option.items) }));
}
