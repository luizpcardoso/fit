import { z } from 'zod';

/** Bundled artwork identifiers; never a URL or an upload supplied by the user. */
export const workoutIllustrationIds = [
  'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'glutes', 'full-body',
  'back-shoulders', 'chest-shoulders', 'chest-triceps', 'back-biceps', 'legs-glutes',
] as const;
export const workoutIllustrationIdSchema = z.enum(workoutIllustrationIds);
export type WorkoutIllustrationId = z.infer<typeof workoutIllustrationIdSchema>;
