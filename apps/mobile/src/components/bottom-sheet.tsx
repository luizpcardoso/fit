import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@/components/icon';
import { Pressable } from '@/components/pressable';
import { Radius, Scrim, Type, type AppPalette } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useAppTheme } from '@/theme/theme-provider';

const native = Platform.OS !== 'web';

/**
 * The app's bottom sheet: the backdrop fades while the sheet slides, and the handle/header can be dragged down to close.
 * Closing also works by the backdrop, the close button and Android back. Content scrolls inside the sheet.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children, footer, scroll = true, testID, backdropLabel = 'Fechar painel' }: {
  visible: boolean; onClose(): void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; scroll?: boolean; testID?: string; backdropLabel?: string;
}) {
  const { colors: c } = useAppTheme(), s = styles(c), reduceMotion = useReduceMotion(), { height } = useWindowDimensions();
  // Stays mounted while the closing animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const [progress] = useState(() => new Animated.Value(0)), [drag] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!mounted) return;
    if (visible) drag.setValue(0);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 240 : 180, useNativeDriver: native });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, mounted, reduceMotion, progress, drag]);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => drag.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 90 || gesture.vy > .8) onClose();
      else Animated.spring(drag, { toValue: 0, speed: 24, bounciness: 4, useNativeDriver: native }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(drag, { toValue: 0, speed: 24, bounciness: 4, useNativeDriver: native }).start(); },
  }), [drag, onClose]);
  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={s.root}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: Scrim, opacity: progress }]}/>
      <Pressable accessibilityRole="button" accessibilityLabel={backdropLabel} onPress={onClose} style={StyleSheet.absoluteFill}/>
      <Animated.View testID={testID} style={[s.sheet, { transform: [{ translateY }] }]}>
        <SafeAreaView edges={['bottom']} style={s.safe}>
          <View {...responder.panHandlers}>
            <View style={s.handle}/>
            <View style={s.header}>
              <View style={s.heading}>
                <Text accessibilityRole="header" numberOfLines={2} style={s.title}>{title}</Text>
                {subtitle ? <Text numberOfLines={2} style={s.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={22} color={c.link}/></Pressable>
            </View>
          </View>
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView> : <View style={s.content}>{children}</View>}
          {footer}
        </SafeAreaView>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: c.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, overflow: 'hidden' },
  safe: { flexShrink: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...Type.title, fontWeight: '800', color: c.text },
  subtitle: { ...Type.label, color: c.textMuted },
  close: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
  content: { padding: 18, paddingTop: 12, gap: 10 },
});
