import MaterialCommunityIcons from '@/components/icon';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { confirmLeave } from '@/utils/unsaved-changes';

/**
 * Standard top bar for stack screens: back (named after its destination) on the left,
 * optional actions and a shortcut to Início on the right. Both ask before discarding
 * work registered with useUnsavedChanges.
 */
export function ScreenHeader({ backLabel = 'Voltar', onBack, showHome = true, right }: { backLabel?: string; onBack?: () => void; showHome?: boolean; right?: ReactNode }) {
  const { colors: c } = useAppTheme();
  const s = createStyles(c);
  const back = async () => {
    if (!(await confirmLeave())) return;
    if (onBack) return onBack();
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const home = async () => { if (await confirmLeave()) router.dismissTo('/'); };
  return <View style={s.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel === 'Voltar' ? 'Voltar' : `Voltar para ${backLabel}`} hitSlop={4} onPress={() => void back()} style={({ pressed }) => [s.back, pressed && s.pressed]}>
      <MaterialCommunityIcons name="chevron-left" size={26} color={c.link} />
      <Text numberOfLines={1} style={s.backText}>{backLabel}</Text>
    </Pressable>
    <View style={s.right}>
      {right}
      {showHome ? <Pressable accessibilityRole="button" accessibilityLabel="Ir para o início" hitSlop={4} onPress={() => void home()} style={({ pressed }) => [s.icon, pressed && s.pressed]}>
        <MaterialCommunityIcons name="home-variant-outline" size={22} color={c.link} />
      </Pressable> : null}
    </View>
  </View>;
}

const createStyles = (c: AppPalette) => StyleSheet.create({
  bar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginLeft: -6, borderRadius: Radius.md, flexShrink: 1 },
  backText: { ...Type.body, color: c.link, fontWeight: '700', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
  pressed: { opacity: 0.7 },
});
