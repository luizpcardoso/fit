import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { usePathname } from 'expo-router';
import type { DailySummary } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { localDay } from '@/utils/health';
import { clearDailySummaryNotification, presentDailySummary, requestDailySummaryPermission } from '@/utils/daily-summary-notification';

type State = { ready: boolean; enabled: boolean; busy: boolean; summary: DailySummary | null; error: string };
type Actions = { setEnabled(value: boolean): Promise<void>; refresh(): Promise<void> };
const initial: State = { ready: false, enabled: false, busy: false, summary: null, error: '' };
const Context = createContext<(State & Actions) | null>(null);

export function DailySummaryProvider({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  return <DailySummarySession key={`${user?.id ?? 'signed-out'}:${loading}`} >{children}</DailySummarySession>;
}

function DailySummarySession({ children }: PropsWithChildren) {
  const { api, user, loading } = useAuth();
  const userId = user?.id;
  const pathname = usePathname();
  const [state, setState] = useState<State>(initial);
  const actions = useRef<Actions>({ setEnabled: async () => {}, refresh: async () => {} });

  useEffect(() => {
    if (Platform.OS !== 'android' || loading) return;
    let active = true;
    let enabled = false;
    let version = 0;
    let lastDate = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = userId ? `fit.daily-summary.${userId}` : null;
    const update = (value: Partial<State>) => { if (active) setState(current => ({ ...current, ...value })); };

    const refresh = async () => {
      if (!active || !enabled || !key || AppState.currentState !== 'active') return;
      const current = ++version;
      const date = localDay();
      lastDate = date;
      const isCurrent = () => active && enabled && version === current && date === localDay();
      update({ busy: true, error: '' });
      try {
        const summary = await api.getDailySummary(date);
        if (!isCurrent()) return;
        await presentDailySummary(summary, isCurrent);
        if (isCurrent()) update({ summary, error: '' });
      } catch (error) {
        if (isCurrent()) update({ error: error instanceof Error && /notificaç/.test(error.message) ? error.message : 'Não foi possível atualizar o resumo. Verifique a conexão e tente novamente.' });
      } finally { if (active && version === current) update({ busy: false }); }
    };
    const scheduleRefresh = () => {
      // Invalidate a response as soon as a write succeeds, before the debounce elapses.
      ++version;
      update({ busy: false });
      clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 350);
    };
    const setEnabled = async (value: boolean) => {
      if (!key || !active) return;
      update({ busy: true, error: '' });
      const previousEnabled = enabled;
      try {
        if (!value) { enabled = false; ++version; await clearDailySummaryNotification(); }
        if (value) await requestDailySummaryPermission();
        if (!active) return;
        await SecureStore.setItemAsync(key, value ? 'true' : 'false');
        if (!active) return;
        enabled = value;
        ++version;
        update({ enabled: value, ...(!value ? { summary: null } : {}) });
        if (value) await refresh();
      } catch (error) {
        enabled = previousEnabled;
        update({ error: error instanceof Error ? error.message : 'Não foi possível alterar o resumo.' });
      } finally { update({ busy: false }); }
    };
    actions.current = { setEnabled, refresh };
    const unsubscribe = api.subscribeToChanges(scheduleRefresh);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') scheduleRefresh(); });
    const overdueCheck = setInterval(() => { if (enabled && AppState.currentState === 'active') scheduleRefresh(); }, 60_000);
    const midnightCheck = setInterval(() => { if (enabled && lastDate !== localDay()) scheduleRefresh(); }, 30_000);
    void (async () => {
      try {
        await clearDailySummaryNotification();
        const stored = key ? await SecureStore.getItemAsync(key) : null;
        if (!active) return;
        enabled = stored === 'true';
        update({ ready: true, enabled });
        if (enabled) await refresh();
      } catch { update({ ready: true, error: 'Não foi possível carregar a preferência do resumo.' }); }
    })();
    return () => {
      active = false; ++version; clearTimeout(timer); clearInterval(midnightCheck); clearInterval(overdueCheck);
      unsubscribe(); subscription.remove();
      void clearDailySummaryNotification().catch(() => {});
    };
  }, [api, loading, userId]);

  useEffect(() => { void actions.current.refresh(); }, [pathname]);
  return <Context.Provider value={{ ...state, setEnabled: value => actions.current.setEnabled(value), refresh: () => actions.current.refresh() }}>{children}</Context.Provider>;
}

export function useDailySummary() {
  const value = useContext(Context);
  if (!value) throw new Error('useDailySummary deve ser usado dentro de DailySummaryProvider.');
  return value;
}
