import { FormInput as TextInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import { formatIntegerInput } from '@/utils/input-format';
import type { AppPalette } from '@/constants/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { days: string; onChange: (days: string) => void; allowUnlimited?: boolean; disabled?: boolean; revealCustomInput?: boolean };
export function ValidityPicker({ days, onChange, allowUnlimited = false, disabled = false, revealCustomInput = false }: Props) {
  const { colors: c, scheme } = useAppTheme(); const s = createStyles(c);
  const [customOpen, setCustomOpen] = useState(false);
  const customVisible = !revealCustomInput || customOpen || !['30', '60', '90', ...(allowUnlimited ? [''] : [])].includes(days);
  const select = (value: string) => { setCustomOpen(false); onChange(value); };

  return <View style={s.root}>
    <View accessibilityRole="radiogroup" accessibilityLabel="Validade da ficha" style={s.options}>{[30, 60, 90].map(value => { const selected = days === String(value) && !(revealCustomInput && customVisible); return <Pressable key={value} accessibilityRole="radio" aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={() => select(String(value))} style={[s.option, revealCustomInput && s.compactOption, selected && s.active]}><Text style={[s.text, selected && s.selected]}>{value} dias</Text></Pressable>; })}{allowUnlimited ? <Pressable accessibilityRole="radio" aria-checked={days === '' && !(revealCustomInput && customVisible)} aria-disabled={disabled} disabled={disabled} onPress={() => select('')} style={[s.option, revealCustomInput && s.compactOption, days === '' && !(revealCustomInput && customVisible) && s.active]}><Text style={[s.text, days === '' && !(revealCustomInput && customVisible) && s.selected]}>Sem prazo</Text></Pressable> : null}{revealCustomInput ? <Pressable accessibilityRole="radio" accessibilityLabel="Outro prazo" aria-checked={customVisible} aria-disabled={disabled} disabled={disabled} onPress={() => setCustomOpen(true)} style={[s.option, s.compactOption, customVisible && s.active]}><Text style={[s.text, customVisible && s.selected]}>Outro prazo</Text></Pressable> : null}</View>
    {customVisible ? <View style={s.root}><Text style={s.label}>Prazo personalizado (1 a 365 dias)</Text>
    <TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel="Prazo de validade em dias" editable={!disabled} keyboardType="number-pad" maxLength={3} value={days} onChangeText={value=>onChange(formatIntegerInput(value,3))} placeholder={allowUnlimited ? 'Ex.: 45 ou deixe vazio' : 'Ex.: 45'} style={s.input} /></View> : null}
  </View>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({ root: { gap: 10 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 44, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, compactOption: { flexGrow: 1, flexBasis: '28%', paddingHorizontal: 8 }, active: { backgroundColor: c.primary, borderColor: c.primary }, text: { color: c.text, fontWeight: '700', fontSize: 13 }, selected: { color: c.onPrimary }, label: { color: c.textMuted, fontSize: 12 }, input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, color: c.text } });
