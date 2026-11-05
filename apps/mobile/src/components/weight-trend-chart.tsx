import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { WeightPoint } from '@fit/contracts';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { formatShortDate, parseLocalDate } from '@/utils/dates';
import { formatMeasure } from '@/utils/numbers';

export const weightRanges = [30, 90, 365] as const;
export type WeightRange = typeof weightRanges[number];
const HEIGHT = 140;

/**
 * Line chart drawn with plain views (no native SVG module, so it ships through OTA).
 * Points are placed by date, so irregular measurements keep their real spacing.
 */
export function WeightTrendChart({ points, range, onRange, loading }: { points: WeightPoint[]; range: WeightRange; onRange(range: WeightRange): void; loading: boolean }) {
  const { colors: c } = useAppTheme(); const s = styles(c);
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const values = points.map(point => point.weightKg);
  const min = Math.min(...values), max = Math.max(...values);
  // Keep at least 1 kg of vertical span so small variations are not exaggerated into cliffs.
  const span = Math.max(1, max - min), floor = min - (span - (max - min)) / 2;
  const first = points.length ? parseLocalDate(points[0].date).getTime() : 0;
  const last = points.length ? parseLocalDate(points[points.length - 1].date).getTime() : 0;
  const x = (date: string) => points.length < 2 || last === first ? width / 2 : (parseLocalDate(date).getTime() - first) / (last - first) * (width - 12) + 6;
  const y = (value: number) => HEIGHT - 8 - (value - floor) / span * (HEIGHT - 16);
  const coords = points.map(point => ({ x: x(point.date), y: y(point.weightKg) }));
  const change = points.length > 1 ? values[values.length - 1] - values[0] : null;
  return <View style={s.card}>
    <View style={s.header}>
      <View style={s.flex}><Text style={s.title}>Evolução do peso</Text><Text style={s.caption}>{change == null ? points.length ? 'Registre outro peso para ver a variação.' : `Nenhum peso nos últimos ${range} dias.` : `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatMeasure(Math.abs(change), 'kg')} em ${range} dias`}</Text></View>
      <View style={s.ranges} accessibilityRole="radiogroup">{weightRanges.map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={range === value} accessibilityLabel={`Últimos ${value} dias`} onPress={() => onRange(value)} style={[s.range, range === value && s.rangeSelected]}><Text style={[s.rangeText, range === value && s.rangeTextSelected]}>{value === 365 ? '1 ano' : `${value} d`}</Text></Pressable>)}</View>
    </View>
    <View accessible accessibilityLabel={points.length ? `Gráfico de peso: de ${formatMeasure(values[0], 'kg')} em ${formatShortDate(points[0].date)} a ${formatMeasure(values[values.length - 1], 'kg')} em ${formatShortDate(points[points.length - 1].date)}; mínimo ${formatMeasure(min, 'kg')}, máximo ${formatMeasure(max, 'kg')}.` : 'Gráfico de peso sem registros no período.'} style={[s.plot, loading && s.loading]} onLayout={onLayout}>
      {points.length && width ? <>
        <View style={[s.grid, { top: y(max) }]} /><View style={[s.grid, { top: y(min) }]} />
        {coords.slice(1).map((point, index) => { const previous = coords[index]; const dx = point.x - previous.x, dy = point.y - previous.y; const length = Math.hypot(dx, dy); return <View key={`l${index}`} style={[s.segment, { width: length, left: (previous.x + point.x) / 2 - length / 2, top: (previous.y + point.y) / 2 - 1, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }]} />; })}
        {coords.map((point, index) => <View key={`p${index}`} style={[s.dot, index === coords.length - 1 && s.lastDot, { left: point.x - (index === coords.length - 1 ? 5 : 3), top: point.y - (index === coords.length - 1 ? 5 : 3) }]} />)}
      </> : <Text style={s.empty}>{loading ? 'Carregando…' : 'Sem pesos neste período'}</Text>}
    </View>
    {points.length > 1 ? <View style={s.footer}><Text style={s.caption}>{formatShortDate(points[0].date)}</Text><Text style={s.caption}>Mín. {formatMeasure(min, 'kg')} · Máx. {formatMeasure(max, 'kg')}</Text><Text style={s.caption}>{formatShortDate(points[points.length - 1].date)}</Text></View> : null}
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, flex: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  title: { ...Type.bodyLarge, fontWeight: '800', color: c.text }, caption: { ...Type.caption, color: c.textMuted },
  ranges: { flexDirection: 'row', gap: 4, backgroundColor: c.surfaceSoft, borderRadius: Radius.md, padding: 3 },
  range: { minHeight: 36, minWidth: 48, paddingHorizontal: 8, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' }, rangeSelected: { backgroundColor: c.surface },
  rangeText: { ...Type.caption, fontWeight: '700', color: c.textMuted }, rangeTextSelected: { color: c.link },
  plot: { height: HEIGHT, overflow: 'hidden' }, loading: { opacity: .5 },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.border },
  segment: { position: 'absolute', height: 2, borderRadius: 1, backgroundColor: c.primary },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary },
  lastDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.surface },
  empty: { ...Type.caption, color: c.textMuted, textAlign: 'center', marginTop: HEIGHT / 2 - 10 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
});
