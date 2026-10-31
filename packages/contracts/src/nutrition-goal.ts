import { z } from 'zod';
export const nutritionGoalInputSchema = z.strictObject({ targetCalories: z.number().int().min(1).max(30000).nullable() });
export type NutritionGoalInput = z.infer<typeof nutritionGoalInputSchema>;
export type ConsumptionGoal = NutritionGoalInput & { remainingCalories: number | null; progress: number | null };
// A consumption target is independent of estimated or recorded exercise expenditure.
export function consumptionGoal(targetCalories: number | null, consumedCalories: number): ConsumptionGoal {
  return { targetCalories, remainingCalories: targetCalories === null ? null : Math.round((targetCalories - consumedCalories) * 1000) / 1000, progress: targetCalories === null ? null : Math.min(1, Math.max(0, consumedCalories / targetCalories)) };
}
