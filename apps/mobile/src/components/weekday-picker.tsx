import type { AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Segunda = 1 … domingo = 7, mesma convenção da API. */
export const weekdayOptions = [
  ['Seg', 1],
  ['Ter', 2],
  ['Qua', 3],
  ['Qui', 4],
  ['Sex', 5],
  ['Sáb', 6],
  ['Dom', 7],
] as const;
const allDays = [1, 2, 3, 4, 5, 6, 7];
const workdays = [1, 2, 3, 4, 5];
const same = (a: number[], b: number[]) => a.length === b.length && a.every((day, index) => day === b[index]);

export function formatWeekdays(days: readonly number[] | null | undefined) {
  const sorted = [...(days ?? allDays)].sort((a, b) => a - b);
  if (same(sorted, allDays)) return 'Todos os dias';
  if (same(sorted, workdays)) return 'Dias úteis';
  return weekdayOptions.filter(([, day]) => sorted.includes(day)).map(([label]) => label).join(', ');
}

export function WeekdayPicker({ value, onChange, disabled, labelSuffix, shortcuts }: {
  value: number[];
  onChange(days: number[]): void;
  disabled?: boolean;
  /** Complemento do nome acessível quando há mais de um seletor na tela. */
  labelSuffix?: string;
  shortcuts?: boolean;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const toggle = (day: number) => onChange(value.includes(day) ? value.filter(item => item !== day) : [...value, day].sort((a, b) => a - b));
  const sorted = [...value].sort((a, b) => a - b);
  return <View style={s.root}>
    <View role="group" aria-label={labelSuffix ? `Dias da semana, ${labelSuffix}` : 'Dias da semana'} style={s.week}>
      {weekdayOptions.map(([label, day]) => {
        const selected = value.includes(day);
        return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={labelSuffix ? `${label}, ${labelSuffix}` : label} aria-checked={selected} disabled={disabled} onPress={() => toggle(day)} style={[s.day, selected && s.daySelected, disabled && s.disabled]}>
          <Text style={[s.dayText, selected && s.dayTextSelected]}>{label.slice(0, 1)}</Text>
          <Text style={[s.daySmall, selected && s.dayTextSelected]}>{label}</Text>
        </Pressable>;
      })}
    </View>
    {shortcuts ? <View style={s.shortcuts}>
      {([['Todos os dias', allDays], ['Dias úteis', workdays]] as const).map(([label, days]) => {
        const selected = same(sorted, [...days]);
        return <Pressable key={label} accessibilityRole="button" aria-pressed={selected} disabled={disabled} onPress={() => onChange([...days])} style={[s.shortcut, selected && s.shortcutSelected]}>
          <Text style={[s.shortcutText, selected && s.shortcutTextSelected]}>{label}</Text>
        </Pressable>;
      })}
    </View> : null}
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  root: { gap: 10 },
  week: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  day: { flex: 1, minWidth: 39, maxWidth: 70, aspectRatio: 0.9, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: 2 },
  daySelected: { backgroundColor: c.primary, borderColor: c.primary },
  disabled: { opacity: 0.6 },
  dayText: { color: c.text, fontSize: 14, fontWeight: '800' },
  daySmall: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  dayTextSelected: { color: c.onPrimary },
  shortcuts: { flexDirection: 'row', gap: 8 },
  shortcut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  shortcutSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  shortcutText: { color: c.textMuted, fontSize: 12, fontWeight: '800' },
  shortcutTextSelected: { color: c.link },
});
