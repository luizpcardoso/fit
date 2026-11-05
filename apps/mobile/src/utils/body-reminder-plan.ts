export type BodyReminderKind = 'weight' | 'measurements';
export type BodyReminderSchedule = { frequency: 'daily' | 'weekly'; weekday: number };
export type BodyReminderPreferences = Record<BodyReminderKind, { enabled: boolean; time: string } & BodyReminderSchedule>;
export const defaultBodyReminders = (): BodyReminderPreferences => ({ weight: { enabled: false, time: '08:00', frequency: 'daily', weekday: 1 }, measurements: { enabled: false, time: '08:15', frequency: 'daily', weekday: 1 } });
export const validBodyReminderTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export function readBodyReminders(raw: string | null): BodyReminderPreferences {
  const result = defaultBodyReminders();
  try { const parsed = JSON.parse(raw || '{}'); for (const kind of ['weight', 'measurements'] as const) if (validBodyReminderTime(parsed?.[kind]?.time)) result[kind] = { enabled: parsed[kind].enabled === true, time: parsed[kind].time, frequency: parsed[kind].frequency === 'weekly' ? 'weekly' : 'daily', weekday: Number.isInteger(parsed[kind].weekday) && parsed[kind].weekday >= 1 && parsed[kind].weekday <= 7 ? parsed[kind].weekday : 1 }; } catch { /* Keep safe defaults. */ }
  return result;
}

export function createBodyReminderSynchronizer(adapter: {
  listOwned(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  prepare(): Promise<void>;
  schedule(user: string, kind: BodyReminderKind, time: string, schedule: BodyReminderSchedule): Promise<string>;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  return (user: string | null, prefs = defaultBodyReminders(), isCurrent = () => true): Promise<void> => {
    const work = async () => {
      for (const id of await adapter.listOwned()) await adapter.cancel(id);
      if (!user || !isCurrent()) return;
      await adapter.prepare();
      for (const kind of ['weight', 'measurements'] as const) {
        if (!prefs[kind].enabled || !isCurrent()) continue;
        const id = await adapter.schedule(user, kind, prefs[kind].time, prefs[kind]);
        if (!isCurrent()) await adapter.cancel(id);
      }
    };
    const next = queue.then(work, work); queue = next.catch(() => {}); return next;
  };
}
