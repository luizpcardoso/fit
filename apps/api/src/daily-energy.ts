import type { DailyEnergyEstimate, DailyExpenditure } from '@fit/contracts';

export type EnergyProfile = { birthDate: string | null; estimationSex: string | null; heightCm: number | null; weightKg: number | null };
export type EnergyCardio = { calories: number; mode: string; met: number | null; weightKg: number | null; durationMinutes: number | null };

// The base covers a full day with minimal everyday movement, never a training multiplier.
// Subtract resting energy from gross exercise calories to avoid counting it twice.
export function dailyEnergy(date: string, profile: EnergyProfile, workoutCount: number, cardios: EnergyCardio[], override: DailyExpenditure | null): DailyEnergyEstimate {
  if (override) return { source: 'recorded', totalCalories: override.totalCalories, baseCalories: null, workoutCalories: null, cardioCalories: null, workoutCount, assumedWorkoutMinutes: 45, missing: [] };
  const missing: DailyEnergyEstimate['missing'] = [];
  if (!profile.birthDate) missing.push('birthDate');
  if (profile.estimationSex !== 'male' && profile.estimationSex !== 'female') missing.push('estimationSex');
  if (!profile.heightCm || profile.heightCm < 80 || profile.heightCm > 250) missing.push('heightCm');
  if (!profile.weightKg || profile.weightKg <= 0 || profile.weightKg > 500) missing.push('weightKg');
  let age = 0;
  if (profile.birthDate) {
    const [y, m, d] = date.split('-').map(Number), [by, bm, bd] = profile.birthDate.split('-').map(Number);
    age = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
    if (!Number.isFinite(age) || age < 19 || age > 78) missing.push('supportedAge');
  }
  if (missing.length) return { source: 'unavailable', totalCalories: null, baseCalories: null, workoutCalories: null, cardioCalories: null, workoutCount, assumedWorkoutMinutes: 45, missing };
  const weight = profile.weightKg!;
  const resting = Math.round(10 * weight + 6.25 * profile.heightCm! - 5 * age + (profile.estimationSex === 'male' ? 5 : -161));
  const baseCalories = Math.round(resting * 1.2);
  const workoutCalories = Math.round((3.5 - 1) * weight * 45 / 60 * workoutCount);
  const cardioCalories = Math.round(cardios.reduce((total, cardio) => {
    if (cardio.mode === 'estimated' && cardio.met != null && cardio.weightKg != null && cardio.durationMinutes != null) {
      return total + Math.max(0, (cardio.met - 1) * cardio.weightKg * cardio.durationMinutes / 60);
    }
    // Manual cardio values are treated as active calories. With no duration, resting energy cannot be removed reliably.
    return total + Math.max(0, cardio.calories - (cardio.durationMinutes == null ? 0 : weight * cardio.durationMinutes / 60));
  }, 0));
  return { source: 'automatic', totalCalories: baseCalories + workoutCalories + cardioCalories, baseCalories, workoutCalories, cardioCalories, workoutCount, assumedWorkoutMinutes: 45, missing: [] };
}
