import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Page } from '@fit/contracts';

// Histories grow without bound: keep the pages already shown and append the next one on request.
// Focusing the screen reloads only the first page, so new records appear without losing order.
export function useLoadMore<P extends Page<{ id: string }>>(load: (page: number) => Promise<P>) {
  type T = P['items'][number];
  const version = useRef(0);
  const [items, setItems] = useState<T[]>([]);
  // Extra fields of the first page (for example, summaries computed by the API) stay available to the screen.
  const [firstPage, setFirstPage] = useState<P | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const current = ++version.current;
    setLoading(true); setError('');
    try { const result = await load(1); if (version.current !== current) return; setFirstPage(result); setItems(result.items); setPage(1); setTotal(result.total); setTotalPages(result.totalPages); }
    catch { if (version.current === current) setError('Não foi possível carregar o histórico. Tente novamente.'); }
    finally { if (version.current === current) setLoading(false); }
  }, [load]);
  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    const current = version.current;
    setLoadingMore(true); setError('');
    try {
      const result = await load(page + 1);
      if (version.current !== current) return;
      // Records added meanwhile shift the pages; skip ids already on screen instead of repeating them.
      setItems(previous => [...previous, ...result.items.filter(item => !previous.some(seen => seen.id === item.id))]);
      setPage(result.page); setTotal(result.total); setTotalPages(result.totalPages);
    } catch { if (version.current === current) setError('Não foi possível carregar mais registros. Tente novamente.'); }
    finally { setLoadingMore(false); }
  }, [load, loadingMore, page, totalPages]);
  useFocusEffect(useCallback(() => { void reload(); return () => { ++version.current; }; }, [reload]));
  return { items, firstPage, total, hasMore: page < totalPages, loading, loadingMore, error, reload, loadMore };
}
