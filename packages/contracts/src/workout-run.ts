import { z } from 'zod';

/** What was actually lifted in one set; null means not informed. Optional so older clients stay compatible. */
export const performedSetSchema = z.strictObject({ set: z.number().int().min(0).max(19), reps: z.number().int().min(0).max(999).nullable(), loadKg: z.number().min(0).max(2000).nullable() });
export type PerformedSet = z.infer<typeof performedSetSchema>;
export const workoutRunProgressSchema = z.strictObject({
  status: z.enum(['running', 'paused', 'completed', 'discarded']),
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().nonnegative().nullable(),
  performedOn: z.string().date(),
  currentIndex: z.number().int().min(0).max(49),
  pausedAt: z.number().int().nonnegative().nullable(),
  pausedMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  restEndsAt: z.number().int().nonnegative().nullable(),
  restRemainingMs: z.number().int().min(0).max(3_600_000).nullable(),
  exercises: z.array(z.strictObject({ id: z.string().uuid(), completedSets: z.array(z.number().int().min(0).max(19)).max(20), skipped: z.boolean(), performed: z.array(performedSetSchema).max(20).optional() })).min(1).max(50),
});
export const saveWorkoutRunSchema = z.strictObject({
  planId: z.string().uuid(), divisionId: z.string().uuid(),
  version: z.number().int().min(0), mutationId: z.string().uuid(),
  progress: workoutRunProgressSchema,
});
export type WorkoutRunProgress = z.infer<typeof workoutRunProgressSchema>;
export type SaveWorkoutRunInput = z.infer<typeof saveWorkoutRunSchema>;
export type WorkoutRun = {
  id: string; planId: string; divisionId: string; planName: string; divisionName: string; divisionLabel: string;
  exercises: import('./index.js').WorkoutExercise[];
  progress: WorkoutRunProgress; version: number; historySessionId: string | null;
};
export function isWorkoutRunOpen(progress: WorkoutRunProgress) { return progress.status === 'running' || progress.status === 'paused'; }
export function workoutRunElapsed(progress: WorkoutRunProgress, now: number) {
  return Math.max(0, (progress.finishedAt ?? progress.pausedAt ?? now) - progress.startedAt - progress.pausedMs);
}
export function toggleWorkoutRunPause(progress: WorkoutRunProgress, now: number): WorkoutRunProgress {
  if (!isWorkoutRunOpen(progress)) return progress;
  if (progress.status === 'running') return { ...progress, status: 'paused', pausedAt: now, restRemainingMs: progress.restEndsAt === null ? null : Math.max(0, progress.restEndsAt - now), restEndsAt: null };
  return { ...progress, status: 'running', pausedMs: progress.pausedMs + Math.max(0, now - (progress.pausedAt ?? now)), pausedAt: null, restEndsAt: progress.restRemainingMs === null ? null : now + progress.restRemainingMs, restRemainingMs: null };
}

/** The same counter rules are used by the app and covered against native controls. */
export function changeWorkoutRunSeries(progress: WorkoutRunProgress, exercises: { id: string; sets: number; restSeconds?: number | null }[], delta: 1 | -1, now: number): WorkoutRunProgress {
  if (progress.status !== 'running') return progress;
  const exercise = exercises[progress.currentIndex];
  const item = progress.exercises.find(e => e.id === exercise?.id);
  if (!exercise || !item) return progress;
  const completedSets = [...item.completedSets];
  if (delta === 1) {
    const next = Array.from({ length: exercise.sets }, (_, i) => i).find(i => !completedSets.includes(i));
    if (next === undefined) return progress;
    completedSets.push(next);
  } else if (completedSets.length) completedSets.pop();
  else return progress;
  const rest = delta === 1 && completedSets.length < exercise.sets ? exercise.restSeconds ?? 0 : 0;
  // Values of an unchecked set no longer describe performed work.
  const performed = item.performed?.filter(entry => completedSets.includes(entry.set));
  return { ...progress, exercises: progress.exercises.map(e => e.id === exercise.id ? { ...e, completedSets, skipped: false, ...(performed ? { performed } : {}) } : e), restEndsAt: rest > 0 ? now + rest * 1000 : null, restRemainingMs: null };
}
/** Last values lifted per exercise, used to prefill the next session ("Anterior"). */
export type WorkoutRunPrevious = Record<string, PerformedSet[]>;

/** Checks or unchecks one specific set and keeps the values typed for it. Rest starts like the counter. */
export function toggleWorkoutRunSet(progress: WorkoutRunProgress, exercises: { id: string; sets: number; restSeconds?: number | null }[], set: number, values: Omit<PerformedSet, 'set'>, now: number): WorkoutRunProgress {
  if (progress.status !== 'running') return progress;
  const exercise = exercises[progress.currentIndex];
  const item = progress.exercises.find(e => e.id === exercise?.id);
  if (!exercise || !item || !Number.isInteger(set) || set < 0 || set >= exercise.sets) return progress;
  const checking = !item.completedSets.includes(set);
  const completedSets = checking ? [...item.completedSets, set] : item.completedSets.filter(index => index !== set);
  const performed = [...(item.performed ?? []).filter(entry => entry.set !== set), ...(checking ? [{ set, ...values }] : [])].sort((a, b) => a.set - b.set);
  const rest = checking && completedSets.length < exercise.sets ? exercise.restSeconds ?? 0 : 0;
  return { ...progress, exercises: progress.exercises.map(e => e.id === exercise.id ? { ...e, completedSets, skipped: false, performed } : e), restEndsAt: rest > 0 ? now + rest * 1000 : checking ? null : progress.restEndsAt, restRemainingMs: null };
}
/** Corrects the values of a set that is already checked, without touching rest or completion. */
export function updateWorkoutRunSetValues(progress: WorkoutRunProgress, exerciseId: string, set: number, values: Omit<PerformedSet, 'set'>): WorkoutRunProgress {
  if (!isWorkoutRunOpen(progress)) return progress;
  return { ...progress, exercises: progress.exercises.map(e => e.id === exerciseId && e.completedSets.includes(set) ? { ...e, performed: [...(e.performed ?? []).filter(entry => entry.set !== set), { set, ...values }].sort((a, b) => a.set - b.set) } : e) };
}
/** kg × reps over sets where both were informed. */
export function workoutRunVolume(progress: WorkoutRunProgress) {
  return progress.exercises.reduce((sum, e) => sum + (e.performed ?? []).filter(entry => e.completedSets.includes(entry.set)).reduce((total, entry) => total + (entry.loadKg ?? 0) * (entry.reps ?? 0), 0), 0);
}

export function moveWorkoutRunExercise(progress: WorkoutRunProgress, count: number, delta: 1 | -1): WorkoutRunProgress {
  if (!isWorkoutRunOpen(progress)) return progress;
  return { ...progress, currentIndex: Math.max(0, Math.min(count - 1, progress.currentIndex + delta)) };
}

/** Completes only the selected exercise; navigation and workout completion remain explicit. */
export function completeWorkoutRunExercise(progress: WorkoutRunProgress, exercises: { id: string; sets: number }[], values?: (set: number) => Omit<PerformedSet, 'set'>): WorkoutRunProgress {
  if (progress.status !== 'running') return progress;
  const exercise = exercises[progress.currentIndex];
  const item = progress.exercises.find(e => e.id === exercise?.id);
  if (!exercise || !item || !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) return progress;
  const completedSets = Array.from({ length: exercise.sets }, (_, index) => index);
  if (!item.skipped && item.completedSets.length === completedSets.length && completedSets.every(index => item.completedSets.includes(index))) return progress;
  // Sets checked now take the values on screen; sets already checked keep what was recorded.
  const recorded = item.performed ?? [];
  const performed = values ? completedSets.map(set => recorded.find(entry => entry.set === set) ?? { set, ...values(set) }) : item.performed;
  return { ...progress, exercises: progress.exercises.map(e => e.id === exercise.id ? { ...e, completedSets, skipped: false, ...(performed ? { performed } : {}) } : e), restEndsAt: null, restRemainingMs: null };
}
