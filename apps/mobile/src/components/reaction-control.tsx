import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GroupReaction } from '@fit/contracts';
import MaterialCommunityIcons from '@/components/icon';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { tapFeedback } from '@/utils/haptics';

export type ReactionCount = { reaction: GroupReaction; count: number; reactedByMe: boolean };

export const reactions: { key: GroupReaction; emoji: string; label: string }[] = [
  { key: 'like', emoji: '👍', label: 'Curtir' },
  { key: 'love', emoji: '❤️', label: 'Amei' },
  { key: 'strength', emoji: '💪', label: 'Força' },
  { key: 'fire', emoji: '🔥', label: 'Mandou bem' },
  { key: 'applause', emoji: '👏', label: 'Parabéns' },
];
/** The reaction a single tap gives when the person has not reacted yet. */
const defaultReaction: GroupReaction = 'like';

export const myReaction = (counts: ReactionCount[] | undefined) => counts?.find(item => item.reactedByMe)?.reaction ?? null;

/** Counts as they will be once the person's reaction becomes `next` (null removes it); one reaction per person. */
export const withMyReaction = (counts: ReactionCount[] | undefined, next: GroupReaction | null): ReactionCount[] =>
  reactions.map(({ key }) => {
    const old = counts?.find(item => item.reaction === key);
    return { reaction: key, count: (old?.count ?? 0) - (old?.reactedByMe ? 1 : 0) + (next === key ? 1 : 0), reactedByMe: next === key };
  }).filter(item => item.count > 0);

/**
 * One main button (tap gives or removes the reaction) and the other reactions behind a long press or the "+" button.
 * `counts` shows each reaction's total next to it, for comments; posts keep their totals in the card summary.
 */
export function ReactionControl({ counts, onReact, labelPrefix = 'Reagir', showCounts = false, open: controlledOpen, onOpenChange }: {
  counts: ReactionCount[] | undefined; onReact(reaction: GroupReaction): void; labelPrefix?: string; showCounts?: boolean; open?: boolean; onOpenChange?(open: boolean): void;
}) {
  const { colors: c } = useAppTheme(), s = styles(c), reduceMotion = useReduceMotion();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => { setInnerOpen(value); onOpenChange?.(value); };
  const mine = myReaction(counts), main = reactions.find(item => item.key === (mine ?? defaultReaction))!;
  const countOf = (key: GroupReaction) => counts?.find(item => item.reaction === key)?.count ?? 0;
  const label = (item: typeof main) => `${labelPrefix}: ${item.label}${showCounts && countOf(item.key) ? ` (${countOf(item.key)})` : ''}`;
  const [scale] = useState(() => new Animated.Value(1)), previous = useRef(mine);
  useEffect(() => {
    if (previous.current === mine) return;
    previous.current = mine;
    if (!mine || reduceMotion) return;
    scale.setValue(.7);
    Animated.spring(scale, { toValue: 1, speed: 26, bounciness: 14, useNativeDriver: true }).start();
  }, [mine, reduceMotion, scale]);
  const react = (key: GroupReaction) => { if (mine !== key) tapFeedback(); setOpen(false); onReact(key); };

  if (open) return <View style={s.row}>
    {reactions.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={label(item)} aria-selected={mine === item.key} aria-pressed={mine === item.key} onPress={() => react(item.key)} style={({ pressed }) => [s.option, mine === item.key && s.selected, pressed && s.pressed]}>
      <Text style={s.emoji}>{item.emoji}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar reações" onPress={() => setOpen(false)} style={({ pressed }) => [s.option, pressed && s.pressed]}><MaterialCommunityIcons name="close" size={20} color={c.textMuted}/></Pressable>
  </View>;

  return <View style={s.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={label(main)} accessibilityHint="Toque e segure para escolher outra reação" aria-selected={Boolean(mine)} aria-pressed={Boolean(mine)} onPress={() => react(main.key)} onLongPress={() => { tapFeedback(); setOpen(true); }} delayLongPress={280} style={({ pressed }) => [s.main, Boolean(mine) && s.selected, pressed && s.pressed]}>
      <Animated.Text style={[s.emoji, { transform: [{ scale }] }]}>{main.emoji}</Animated.Text>
      {showCounts ? (countOf(main.key) ? <Text style={s.count}>{countOf(main.key)}</Text> : null) : <Text style={[s.mainLabel, Boolean(mine) && { color: c.link }]}>{main.label}</Text>}
    </Pressable>
    {showCounts ? reactions.filter(item => item.key !== main.key && countOf(item.key) > 0).map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={label(item)} aria-selected={false} aria-pressed={false} onPress={() => react(item.key)} style={({ pressed }) => [s.main, pressed && s.pressed]}>
      <Text style={s.emoji}>{item.emoji}</Text><Text style={s.count}>{countOf(item.key)}</Text>
    </Pressable>) : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Mais reações" aria-expanded={false} onPress={() => setOpen(true)} style={({ pressed }) => [s.option, pressed && s.pressed]}><MaterialCommunityIcons name="emoticon-plus-outline" size={20} color={c.textMuted}/></Pressable>
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2, flexShrink: 1 },
  main: { minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'transparent' },
  option: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  selected: { backgroundColor: c.primarySoft, borderColor: c.primary },
  pressed: { opacity: .6 },
  emoji: { fontSize: 18 },
  mainLabel: { ...Type.caption, fontWeight: '800', color: c.textMuted },
  count: { ...Type.caption, color: c.textMuted },
});
