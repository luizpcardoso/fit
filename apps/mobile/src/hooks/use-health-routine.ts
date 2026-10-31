import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { HealthItem, HealthKind, HealthToday } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { localDay } from '@/utils/health';

export function useHealthClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return now;
}

export function useHealthRoutine(kind: HealthKind, date: string, includeList = false) {
  const { api } = useAuth();
  const [data, setData] = useState<{ key: string; daily: HealthToday; items: HealthItem[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const key = `${kind}:${date}:${includeList}`;
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [daily, items] = await Promise.all([api.getHealthToday(kind, date), includeList ? api.listHealthItems(kind) : Promise.resolve([])]);
      if (version === requestVersion.current) { setData({ key, daily, items }); setFailure(null); }
      return true;
    } catch {
      if (version === requestVersion.current) setFailure({ key, message: 'Não foi possível atualizar sua rotina. Verifique a conexão e tente novamente.' });
      return false;
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [api, kind, date, includeList, key]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { ++requestVersion.current; subscription.remove(); };
  }, [refresh]));
  const matches = data?.key === key;
  const error = failure?.key === key ? failure.message : '';
  return { daily: matches ? data.daily : null, items: matches ? data.items : [], error, loading: loading || (!matches && !error), refresh, date, kind };
}

export { localDay };
