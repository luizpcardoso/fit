import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/theme/theme-provider';
import { Type } from '@/constants/theme';
import { useAuth } from '@/auth/auth-context';

type Panel = { id: string; title: string; content: ReactNode };
const gap = 12;
const peek = 28;
// From this width the panels fit side by side, so selectors and swiping are not needed.
const sideBySide = 900;
// Keep the navigation topic when a web/native stack remounts Início. No health data is stored.
let lastSelection: { owner: string | undefined; topic: string } | null = null;

/** Mounted panels stretch to the tallest content, so topic changes never move the page. */
export function HomeAccompaniment({ panels }: { panels: Panel[] }) {
  const { colors: c } = useAppTheme();
  const { user } = useAuth();
  const owner = user?.id;
  const [selected, setSelected] = useState(() => lastSelection && lastSelection.owner === owner ? lastSelection.topic : 'workout');
  useLayoutEffect(() => { lastSelection = { owner, topic: selected }; }, [owner, selected]);
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const tabs = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const target = useRef<number | null>(null);
  const offset = useRef(0);
  const focused = useRef(false);
  const index = Math.max(0, panels.findIndex(panel => panel.id === selected));
  const activeIndex = useRef(index);
  useLayoutEffect(() => { activeIndex.current = index; }, [index]);
  if (!panels.some(panel => panel.id === selected)) setSelected(panels[0].id);
  const panelWidth = Math.max(0, width - peek);
  const wide = width >= sideBySide;
  const step = panelWidth + gap;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  // Restore before resize/removal scroll events can select a different topic.
  const restore = useCallback(() => {
    const restored = Math.min(activeIndex.current, panels.length - 1);
    const x = restored * step;
    target.current = Math.abs(offset.current - x) < 2 ? null : restored;
    scroll.current?.scrollTo({ x, animated: false });
  }, [step, panels.length]);
  useLayoutEffect(restore, [restore]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    restore();
    return () => { focused.current = false; };
  }, [restore]));

  const select = (next: number) => {
    target.current = Math.abs(offset.current - next * step) < 2 ? null : next;
    setSelected(panels[next].id);
    scroll.current?.scrollTo({ x: next * step, animated: !reduceMotion });
  };
  return <View testID="home-accompaniment" style={{ gap: 12 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text accessibilityRole="header" style={{ ...Type.title, color: c.text, fontWeight: '800' }}>Seu acompanhamento</Text>
    {wide ? <View testID="home-topic-grid" style={{ flexDirection: 'row', alignItems: 'stretch', gap }}>
      {panels.map(panel => <View key={panel.id} style={{ flex: 1, minWidth: 0 }}>{panel.content}</View>)}
    </View> : <>
    <View accessibilityRole="tablist" accessibilityLabel="Temas do acompanhamento" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: c.surfaceSoft }}>
      {panels.map((panel, position) => <Pressable key={panel.id} ref={element => { tabs.current[position] = element; }} nativeID={`home-tab-${panel.id}`}
        accessibilityRole="tab" aria-selected={position === index} aria-controls={`home-panel-${panel.id}`}
        {...(Platform.OS === 'web' ? { tabIndex: position === index ? 0 : -1, onKeyDown: (event: Parameters<NonNullable<ComponentProps<typeof Pressable>['onKeyDown']>>[0]) => {
          const key = 'key' in event ? event.key : event.nativeEvent.key;
          const next = key === 'ArrowRight' ? (index + 1) % panels.length : key === 'ArrowLeft' ? (index + panels.length - 1) % panels.length : key === 'Home' ? 0 : key === 'End' ? panels.length - 1 : null;
          if (next == null) return;
          event.preventDefault(); select(next);
          (tabs.current[next] as unknown as { focus?(): void })?.focus?.();
        } } : {})}
        onPress={() => select(position)} style={{ flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: position === index ? c.surface : 'transparent' }}>
        {/* Native: one line that shrinks under enlarged system text. Web keeps wrapping (no font-fit support). */}
        <Text {...(Platform.OS === 'web' ? {} : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75, maxFontSizeMultiplier: 1.3 })} style={{ ...Type.label, maxWidth: '100%', flexShrink: 1, textAlign: 'center', color: position === index ? c.link : c.textMuted, fontWeight: position === index ? '800' : '500' }}>{panel.title}</Text>
      </Pressable>)}
    </View>
    {width > 0 ? <ScrollView ref={scroll} testID="home-topic-scroll" horizontal directionalLockEnabled nestedScrollEnabled
      showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" disableIntervalMomentum
      onTouchStart={() => { target.current = null; }}
      {...(Platform.OS === 'web' ? { onWheel: () => { target.current = null; } } : {})}
      onScrollBeginDrag={() => { target.current = null; }} scrollEventThrottle={16}
      onScroll={event => {
        offset.current = event.nativeEvent.contentOffset.x;
        if (!focused.current) return;
        const x = event.nativeEvent.contentOffset.x;
        const next = Math.max(0, Math.min(panels.length - 1, Math.round(x / step)));
        if (target.current != null) {
          if (Math.abs(x - target.current * step) > 2) return;
          target.current = null;
        }
        if (next !== index) setSelected(panels[next].id);
      }}
      style={{ flexGrow: 0, ...(Platform.OS === 'web' ? { scrollSnapType: 'x mandatory' } : {}) }} contentContainerStyle={{ gap, alignItems: 'stretch' }}>
      {panels.map((panel, position) => <View key={panel.id} nativeID={`home-panel-${panel.id}`}
        role={position === index ? 'tabpanel' : undefined} aria-labelledby={`home-tab-${panel.id}`}
        aria-hidden={position !== index} accessibilityElementsHidden={position !== index}
        importantForAccessibility={position === index ? 'auto' : 'no-hide-descendants'}
        pointerEvents={position === index ? 'auto' : 'none'}
        {...(Platform.OS === 'web' ? { inert: position !== index } : {})}
        // The last panel takes the peek space too, so its edge lines up with the selectors.
        style={{ width: position === panels.length - 1 ? width : panelWidth, ...(Platform.OS === 'web' ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : {}) }}>
        {panel.content}
      </View>)}
    </ScrollView> : null}
    </>}
  </View>;
}
