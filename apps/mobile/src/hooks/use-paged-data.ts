import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// The request version prevents old search/page responses from replacing the visible page.
export function usePagedData<T>(key: string, load: () => Promise<T>) {
  const version = useRef(0);
  const [state, setState] = useState<{ key: string; data: T } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    setBusy(true);
    try { const data = await load(); if (version.current === current) { setState({ key, data }); setFailure(null); } return true; }
    catch { if (version.current === current) setFailure({ key, message: 'Não foi possível atualizar os registros. Tente novamente.' }); return false; }
    finally { if (version.current === current) setBusy(false); }
  }, [key, load]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { ++version.current; }; }, [refresh]));
  const error = failure?.key === key ? failure.message : '';
  return { data: state?.key === key ? state.data : null, loading: busy || (state?.key !== key && !error), error, refresh };
}
