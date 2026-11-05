import { localDate } from './dates';
import { dateInputToIso } from './date-input';

export function mealClock(value = new Date()) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
export function stepMealTime(value: string, direction: -1 | 1): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  const next = hour * 60 + minute + direction * 30;
  if (next < 0 || next >= 1440) return null;
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}
export function resolveMealWhen(mode: 'now' | 'custom', dateInput: string, customTime: string, now = new Date()) {
  return mode === 'now' ? { date: localDate(now), time: mealClock(now) } : { date: dateInputToIso(dateInput), time: customTime };
}
