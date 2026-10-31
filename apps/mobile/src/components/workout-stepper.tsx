import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormInput } from './form-input';
import { useAppTheme } from '@/theme/theme-provider';

export function WorkoutStepper({ label, value, onChange, onStep, canDecrease = true, canIncrease = true, numeric = true }: {
  label: string; value: string; onChange(value: string): void; onStep(direction: -1 | 1): void;
  canDecrease?: boolean; canIncrease?: boolean; numeric?: boolean;
}) {
  const { colors: c } = useAppTheme();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface }}>
    {([-1, 1] as const).map(direction => {
      const disabled = direction === -1 ? !canDecrease : !canIncrease;
      const button = <Pressable key={direction} accessibilityRole="button" accessibilityLabel={`${direction === -1 ? 'Diminuir' : 'Aumentar'} ${label}`} disabled={disabled}
        onPress={() => { setFocused(false); onStep(direction); }} style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .35 : 1 }}>
        <Text style={{ color: c.link, fontSize: 23, fontWeight: '700' }}>{direction === -1 ? '−' : '+'}</Text>
      </Pressable>;
      return direction === -1 ? <View key={direction} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>{button}<FormInput accessibilityLabel={label} value={focused ? draft : value} selectTextOnFocus
        keyboardType={numeric ? 'decimal-pad' : 'default'} maxLength={30} onFocus={() => { setDraft(value); setFocused(true); }} onBlur={() => setFocused(false)}
        onChangeText={text => { setFocused(true); setDraft(text); onChange(text); }} style={{ flex: 1, minWidth: 30, textAlign: 'center', paddingHorizontal: 0, fontSize: 16 }} /></View> : button;
    })}
  </View>;
}
