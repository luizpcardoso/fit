import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Pressable } from '@/components/pressable';
import { useAppTheme } from '@/theme/theme-provider';

/** Equal image and caption space keeps all options aligned, including long names. */
export function ImageChoiceCard({ label, selected, disabled = false, onPress, children, width = 112 }: {
  label: string; selected: boolean; disabled?: boolean; onPress(): void; children: ReactNode; width?: number;
}) {
  const { colors: c } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={onPress}
    style={{ width, flexShrink: 0, padding: 8, gap: 8, borderWidth: 2, borderRadius: 16, borderColor: selected ? c.link : c.border, backgroundColor: selected ? c.primarySoft : c.surfaceSoft, opacity: disabled ? .5 : 1 }}>
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    <Text numberOfLines={2} style={{ height: 36 * fontScale, fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'center', color: selected ? c.link : c.text }}>{label}</Text>
  </Pressable>;
}
