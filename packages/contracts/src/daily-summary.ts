import { z } from 'zod';

export const dailySummaryQuerySchema = z.strictObject({ date: z.string().date() });

// Only aggregate values and fixed categories may leave the API for the notification.
export const dailySummarySchema = z.strictObject({
  date: z.string().date(),
  updatedAt: z.string().datetime(),
  checks: z.strictObject({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
  nutrition: z.strictObject({
    consumedCalories: z.number().nonnegative(),
    targetCalories: z.number().positive().nullable(),
    balance: z.number().nullable(),
  }),
  pending: z.enum(['checks', 'check-in', 'workout']).nullable(),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;
