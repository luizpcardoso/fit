import { QuickRegisterSheet } from '@/components/home-shortcuts';
import { WorkoutMiniPlayer } from '@/components/workout-mini-player';
import MaterialCommunityIcons from '@/components/icon';
import { CardShadow, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type DockIcons = Record<string, { active: IconName; inactive: IconName }>;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduce(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduce;
}

/** Destination in the pill: icon only at rest; the focused one grows into icon + label. */
function DockItem({ label, icon, focused, reduceMotion, onPress, onLongPress }: { label: string; icon: { active: IconName; inactive: IconName }; focused: boolean; reduceMotion: boolean; onPress(): void; onLongPress(): void }) {
  const { colors: c } = useAppTheme(); const s = styles(c);
  const [progress] = useState(() => new Animated.Value(focused ? 1 : 0));
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) { progress.setValue(focused ? 1 : 0); return; }
    // flexGrow is a layout prop, so this spring runs on the JS driver.
    Animated.spring(progress, { toValue: focused ? 1 : 0, speed: 16, bounciness: 5, useNativeDriver: false }).start();
  }, [focused, progress, reduceMotion]);
  const pressIn = () => Animated.timing(scale, { toValue: .92, duration: 85, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, speed: 32, bounciness: 6, useNativeDriver: true }).start();
  const flexGrow = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 3] });
  return <Animated.View style={[s.slot, { flexGrow }]}>
    <Pressable accessibilityRole="tab" aria-selected={focused} accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} onPressIn={pressIn} onPressOut={pressOut} android_ripple={{ color: 'transparent' }} style={s.touch}>
      <Animated.View style={[s.item, { transform: [{ scale }] }]}>
        <Animated.View pointerEvents="none" style={[s.indicator, { opacity: progress }]}/>
        <MaterialCommunityIcons name={focused ? icon.active : icon.inactive} size={focused ? 20 : 23} color={focused ? c.onPrimary : c.textMuted}/>
        {focused ? <Animated.Text numberOfLines={1} aria-hidden style={[s.label, { opacity: progress }]}>{label}</Animated.Text> : null}
      </Animated.View>
    </Pressable>
  </Animated.View>;
}

/**
 * Floating dock for the main tabs: destinations live in the pill, the separate + button
 * is the global "Registrar" action and the workout mini-player sits above both.
 * It stays in the layout flow (not over the content) and absorbs the bottom safe-area inset.
 */
export function NavigationDock({ state, descriptors, emitter, navigateToTab, insets, icons }: BottomTabBarProps & { icons: DockIcons }) {
  const { colors: c } = useAppTheme(); const s = styles(c);
  const reduceMotion = useReduceMotion();
  const keyboardVisible = useKeyboardState(keyboard => keyboard.isVisible);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const value = registerOpen ? 1 : 0;
    if (reduceMotion) turn.setValue(value);
    else Animated.spring(turn, { toValue: value, speed: 20, bounciness: 6, useNativeDriver: true }).start();
  }, [reduceMotion, registerOpen, turn]);
  if (keyboardVisible) return null;
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return <View style={[s.wrap, { paddingBottom: 10 + insets.bottom }]}>
    <View style={s.column}>
      <WorkoutMiniPlayer/>
      <View style={s.row}>
        <View role="tablist" style={[s.pill, CardShadow]}>
          {state.routes.map((route, index) => {
            const focused = index === state.index;
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const onPress = () => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            };
            const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
            return <DockItem key={route.key} label={label} icon={icons[route.name]} focused={focused} reduceMotion={reduceMotion} onPress={onPress} onLongPress={onLongPress}/>;
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Registrar: treino, refeição, cardio e mais" aria-expanded={registerOpen} onPress={() => setRegisterOpen(true)} style={({ pressed }) => [s.fab, CardShadow, pressed && s.fabPressed]}>
          <Animated.View style={{ transform: [{ rotate }] }}><MaterialCommunityIcons name="plus" size={28} color={c.onPrimary}/></Animated.View>
        </Pressable>
      </View>
    </View>
    <QuickRegisterSheet visible={registerOpen} onClose={() => setRegisterOpen(false)}/>
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6, backgroundColor: c.background },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flex: 1, minWidth: 0, height: 60, flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 30, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  slot: { flexBasis: 0, minWidth: 44, height: '100%' },
  touch: { flex: 1 },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 26, overflow: 'hidden' },
  indicator: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 26, backgroundColor: c.primary },
  label: { flexShrink: 1, fontSize: 12, fontWeight: '800', letterSpacing: -.1, color: c.onPrimary },
  fab: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderWidth: 3, borderColor: c.primarySoft },
  fabPressed: { transform: [{ scale: .94 }], backgroundColor: c.primaryStrong },
});
