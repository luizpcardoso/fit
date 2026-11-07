import { z } from 'zod';

export const mealCategoryIds = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'] as const;
export const mealCategorySchema = z.enum(mealCategoryIds);
export type MealCategory = z.infer<typeof mealCategorySchema>;

/** Product reference windows, not measured population averages or required meal times. */
export const mealCategories: readonly { id: MealCategory; label: string; from: number; to: number }[] = [
  { id: 'breakfast', label: 'Café da manhã', from: 6 * 60, to: 9 * 60 },
  { id: 'morning_snack', label: 'Lanche da manhã', from: 9 * 60, to: 11 * 60 },
  { id: 'lunch', label: 'Almoço', from: 11 * 60, to: 14 * 60 },
  { id: 'afternoon_snack', label: 'Lanche da tarde', from: 14 * 60, to: 17 * 60 },
  { id: 'dinner', label: 'Jantar', from: 18 * 60, to: 21 * 60 },
  { id: 'supper', label: 'Ceia', from: 21 * 60, to: 23 * 60 },
];
/** Suggested time for a category: the person's saved time when present, else the window midpoint. */
export function mealCategoryTime(category?: MealCategory | null, overrides?: Partial<Record<MealCategory, string>>) {
  const item = mealCategories.find(value => value.id === category);
  if (!item) return null;
  const custom = overrides?.[item.id];
  if (custom) return custom;
  const minutes = Math.round((item.from + item.to) / 2 / 30) * 30;
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
export function mealCategoryLabel(category?: MealCategory | null) {
  return mealCategories.find(value => value.id === category)?.label ?? null;
}
