import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { defaultBodyReminders, validBodyReminderTime, validBodyReminderWeekdays, type BodyReminderSchedule, type BodyReminderKind, type BodyReminderPreferences } from '@/utils/body-reminder-plan';
import { loadBodyReminders, persistBodyReminders, requestBodyReminderPermission, syncBodyReminders } from '@/utils/body-reminders';
const Context = createContext<{ prefs: BodyReminderPreferences; ready: boolean; busy: boolean; error: string; save(kind: BodyReminderKind, enabled: boolean, time: string, schedule?: BodyReminderSchedule): Promise<boolean> } | null>(null);
export function BodyRemindersProvider({ children }: PropsWithChildren) {
  const { user, loading } = useAuth(); return <Session key={`${user?.id ?? 'out'}:${loading}`} userId={loading ? undefined : user?.id}>{children}</Session>;
}
function Session({ userId, children }: PropsWithChildren<{ userId?: string }>) {
  const [prefs, setPrefs] = useState(defaultBodyReminders), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const action = useRef<(kind: BodyReminderKind, enabled: boolean, time: string, schedule?: BodyReminderSchedule) => Promise<boolean>>(async () => false);
  useEffect(() => {
    let active = true, saving = false; let current = defaultBodyReminders();
    action.current = async (kind, enabled, time, schedule) => {
      if (!userId || !active || saving) return false;
      if (!validBodyReminderTime(time)) { setError('Informe um horário válido no formato HH:MM.'); return false; }
      if (schedule && !validBodyReminderWeekdays(schedule.weekdays)) { setError('Escolha ao menos um dia da semana.'); return false; }
      saving = true; setBusy(true); setError(''); const previous = current;
      try {
        if (enabled) await requestBodyReminderPermission();
        if (!active) return false;
        const next = { ...current, [kind]: { ...current[kind], ...schedule, enabled, time } };
        await syncBodyReminders(userId, next, () => active);
        if (!active) return false;
        await persistBodyReminders(userId, next); current = next;
        if (active) setPrefs(next);
        return true;
      } catch { if (active) { setError('Não foi possível salvar o lembrete. Confira a permissão de notificações e tente novamente.'); await syncBodyReminders(userId, previous, () => active).catch(() => {}); } return false; }
      finally { saving = false; if (active) setBusy(false); }
    };
    void (async () => {
      try { current = userId ? await loadBodyReminders(userId) : defaultBodyReminders(); if (!active) return; await syncBodyReminders(userId ?? null, current, () => active); if (active) { setPrefs(current); setReady(true); } }
      catch { if (active) { setReady(true); setError('Não foi possível carregar os lembretes. Tente configurá-los novamente.'); } }
    })();
    return () => { active = false; void syncBodyReminders(null).catch(() => {}); };
  }, [userId]);
  return <Context.Provider value={{ prefs, ready: ready || Platform.OS === 'web', busy, error, save: (...args) => action.current(...args) }}>{children}</Context.Provider>;
}
export const useBodyReminders = () => { const value = useContext(Context); if (!value) throw new Error('BodyRemindersProvider ausente.'); return value; };
