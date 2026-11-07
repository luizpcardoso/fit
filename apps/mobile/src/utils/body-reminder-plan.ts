export type BodyReminderKind = 'weight' | 'measurements';
/** Monday = 1 … Sunday = 7, the same convention as the rest of the app. All seven days = daily. */
export type BodyReminderSchedule = { weekdays: number[] };
export type BodyReminderPreferences = Record<BodyReminderKind, { enabled: boolean; time: string } & BodyReminderSchedule>;
export const everyDay = [1, 2, 3, 4, 5, 6, 7];
export const defaultBodyReminders = (): BodyReminderPreferences => ({ weight: { enabled: false, time: '08:00', weekdays: [...everyDay] }, measurements: { enabled: false, time: '08:15', weekdays: [...everyDay] } });
export const validBodyReminderTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export const validBodyReminderWeekdays = (weekdays: unknown): weekdays is number[] => Array.isArray(weekdays) && weekdays.length > 0 && weekdays.length <= 7 && new Set(weekdays).size === weekdays.length && weekdays.every(day => Number.isInteger(day) && day >= 1 && day <= 7);
/** Expo numbers weekly triggers Sunday = 1 … Saturday = 7. */
export const expoWeekday = (weekday: number) => weekday === 7 ? 1 : weekday + 1;
const fromExpoWeekday = (weekday: number) => weekday === 1 ? 7 : weekday - 1;
function readWeekdays(value: { weekdays?: unknown; frequency?: unknown; weekday?: unknown }) {
  if (validBodyReminderWeekdays(value.weekdays)) return [...value.weekdays].sort((a, b) => a - b);
  // Legacy shape: { frequency: 'daily' | 'weekly', weekday } with Expo numbering.
  if (value.frequency === 'weekly') return [fromExpoWeekday(Number.isInteger(value.weekday) && Number(value.weekday) >= 1 && Number(value.weekday) <= 7 ? Number(value.weekday) : 1)];
  return [...everyDay];
}
export function readBodyReminders(raw: string | null): BodyReminderPreferences {
  const result = defaultBodyReminders();
  try { const parsed = JSON.parse(raw || '{}'); for (const kind of ['weight', 'measurements'] as const) if (validBodyReminderTime(parsed?.[kind]?.time)) result[kind] = { enabled: parsed[kind].enabled === true, time: parsed[kind].time, weekdays: readWeekdays(parsed[kind]) }; } catch { /* Keep safe defaults. */ }
  return result;
}

export function createBodyReminderSynchronizer(adapter: {
  listOwned(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  prepare(): Promise<void>;
  /** `weekday` null = daily trigger; otherwise one weekly trigger for that day (Monday = 1). */
  schedule(user: string, kind: BodyReminderKind, time: string, weekday: number | null): Promise<string>;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  return (user: string | null, prefs = defaultBodyReminders(), isCurrent = () => true): Promise<void> => {
    const work = async () => {
      for (const id of await adapter.listOwned()) await adapter.cancel(id);
      if (!user || !isCurrent()) return;
      await adapter.prepare();
      for (const kind of ['weight', 'measurements'] as const) {
        if (!prefs[kind].enabled || !isCurrent()) continue;
        const days = prefs[kind].weekdays.length >= 7 ? [null] : prefs[kind].weekdays;
        for (const weekday of days) {
          const id = await adapter.schedule(user, kind, prefs[kind].time, weekday);
          if (!isCurrent()) { await adapter.cancel(id); return; }
        }
      }
    };
    const next = queue.then(work, work); queue = next.catch(() => {}); return next;
  };
}
