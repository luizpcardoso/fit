import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';
export function Pagination({ page, totalPages, loading, onPage }: { page: number; totalPages: number; loading: boolean; onPage(page: number): void }) {
  const { colors: c } = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8 }}>
    {([-1, 0, 1] as const).map(direction => direction === 0 ? <Text key={direction} accessibilityLiveRegion="polite" style={{ color: c.textMuted, flex: 1, textAlign: 'center', fontSize: 12 }}>Página {page} de {totalPages}</Text> : <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Página anterior' : 'Próxima página'} disabled={loading || (direction < 0 ? page <= 1 : page >= totalPages)} onPress={() => onPage(page + direction)} style={{ minHeight: 44, minWidth: 72, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: c.surfaceSoft, opacity: loading || (direction < 0 ? page <= 1 : page >= totalPages) ? .45 : 1 }}><Text style={{ color: c.link, fontWeight: '700', fontSize: 12 }}>{direction < 0 ? 'Anterior' : 'Próxima'}</Text></Pressable>)}
  </View>;
}
