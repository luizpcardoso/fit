import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type } from '@/constants/theme';

/** Footer for growing histories: how much is visible and a single "Carregar mais" action. */
export function LoadMore({ shown, total, hasMore, loading, error, onPress, noun }: { shown: number; total: number; hasMore: boolean; loading: boolean; error?: string; onPress(): void; noun: string }) {
  const { colors: c } = useAppTheme();
  if (!total) return null;
  return <View style={{ gap: 8, alignItems: 'center', paddingVertical: 4 }}>
    <Text accessibilityLiveRegion="polite" style={{ ...Type.caption, color: error ? c.danger : c.textMuted, textAlign: 'center' }}>{error || (hasMore ? `Mostrando ${shown} de ${total} ${noun}` : `Todos os ${total} ${noun} exibidos`)}</Text>
    {hasMore ? <Pressable accessibilityRole="button" aria-busy={loading} disabled={loading} onPress={onPress} style={{ minHeight: 48, minWidth: 180, paddingHorizontal: 18, borderRadius: Radius.md, backgroundColor: c.surfaceSoft, alignItems: 'center', justifyContent: 'center' }}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando mais registros" color={c.link}/> : <Text style={{ ...Type.body, fontWeight: '800', color: c.link }}>{error ? 'Tentar novamente' : 'Carregar mais'}</Text>}
    </Pressable> : null}
  </View>;
}

/** Long lists already in memory render in steps, so a big history never builds hundreds of rows at once. */
export function useShowMore<T>(items: T[], step = 20) {
  const [count, setCount] = useState(step);
  return { visible: items.slice(0, count), hasMore: items.length > count, more: () => setCount(value => value + step), total: items.length };
}
export function ShowMore({ shown, total, onPress, noun }: { shown: number; total: number; onPress(): void; noun: string }) {
  if (shown >= total) return null;
  return <LoadMore shown={Math.min(shown, total)} total={total} hasMore={shown < total} loading={false} onPress={onPress} noun={noun} />;
}
