import { useEffect, useState, type ReactNode } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Radius } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useAppTheme } from '@/theme/theme-provider';

/** Placeholder block with the shape of the content that is loading; pulses unless "reduzir movimento" is on. */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useAppTheme(), reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(.55));
  useEffect(() => {
    if (reduceMotion) { pulse.setValue(.7); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: .55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: c.surfaceSoft, opacity: pulse }, style]}/>;
}

/** Groups skeleton blocks as one "loading" element for assistive technologies. */
export function SkeletonGroup({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} aria-busy style={style}>{children}</View>;
}

/** Card-shaped placeholder: a title line, two text lines and an optional action. */
export function SkeletonCard({ lines = 2, action = false, height }: { lines?: number; action?: boolean; height?: number }) {
  const { colors: c } = useAppTheme();
  return <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, padding: 16, gap: 12, minHeight: height }}>
    <Skeleton width="55%" height={20}/>
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} width={index === lines - 1 ? '70%' : '100%'} height={14}/>)}
    {action ? <Skeleton height={48} radius={Radius.lg} style={{ marginTop: 4 }}/> : null}
  </View>;
}
