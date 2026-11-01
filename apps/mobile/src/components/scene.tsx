import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Type } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

// Ilustrações geradas por scripts/generate-scenes.mjs. O lado esquerdo já vem escurecido para texto branco.
export const SceneImages = {
  sunrise: require('../../assets/images/scenes/sunrise.webp'),
  workout: require('../../assets/images/scenes/workout.webp'),
  mind: require('../../assets/images/scenes/mind.webp'),
  nutrition: require('../../assets/images/scenes/nutrition.webp'),
  health: require('../../assets/images/scenes/health.webp'),
  groups: require('../../assets/images/scenes/groups.webp'),
  // Recortes verticais para cartões altos (meta semanal do Início e ficha ativa).
  pulseTall: require('../../assets/images/scenes/pulse-tall.webp'),
  workoutSquare: require('../../assets/images/scenes/workout-square.webp'),
} as const;
export type SceneName = keyof typeof SceneImages;

/** Imagem decorativa que preenche o cartão pai (que deve ter overflow hidden). `dim` escurece tudo quando o texto ocupa a largura inteira. */
export function SceneBackdrop({ scene, dim = 0 }: { scene: SceneName; dim?: number }) {
  return <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={SceneImages[scene]} contentFit="cover" contentPosition="right center" transition={0} style={StyleSheet.absoluteFill} accessible={false} />
    {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(11,30,40,${dim})` }]} /> : null}
  </View>;
}

/** Faixa ilustrada com texto curto à esquerda; não é interativa para não competir com as ações da tela. */
export function SceneBanner({ scene, eyebrow, title, text, height = 128, style, children }: PropsWithChildren<{ scene: SceneName; eyebrow?: string; title: string; text?: string; height?: number; style?: StyleProp<ViewStyle> }>) {
  const { colors: c } = useAppTheme();
  return <View style={[styles.banner, { minHeight: height, backgroundColor: c.primaryStrong }, style]}>
    <SceneBackdrop scene={scene} />
    <View style={styles.copy}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: c.heroMuted }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: c.onHero }]}>{title}</Text>
      {text ? <Text style={[styles.text, { color: c.heroMuted }]}>{text}</Text> : null}
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  banner: { borderRadius: Radius.xxl, overflow: 'hidden', justifyContent: 'center' },
  copy: { padding: 18, maxWidth: '62%', gap: 3 },
  eyebrow: { ...Type.caption, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { ...Type.title, fontWeight: '800', letterSpacing: -0.3 },
  text: { ...Type.caption, marginTop: 2 },
});
