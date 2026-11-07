import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

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
  // Cartões das áreas (FeatureCategoryGrid): véu de baixo para cima, onde ficam título e descrição.
  cardBody: require('../../assets/images/scenes/card-body.webp'),
  cardMedication: require('../../assets/images/scenes/card-medication.webp'),
  cardSupplement: require('../../assets/images/scenes/card-supplement.webp'),
  cardInjectable: require('../../assets/images/scenes/card-injectable.webp'),
  cardMind: require('../../assets/images/scenes/card-mind.webp'),
  cardFood: require('../../assets/images/scenes/card-food.webp'),
  cardDiet: require('../../assets/images/scenes/card-diet.webp'),
  cardPlans: require('../../assets/images/scenes/card-plans.webp'),
  cardHistory: require('../../assets/images/scenes/card-history.webp'),
  cardCardio: require('../../assets/images/scenes/card-cardio.webp'),
  // Miniaturas quadradas e centralizadas (SceneThumb): atalhos, folha Registrar e estados vazios.
  thumbMind: require('../../assets/images/scenes/thumb-mind.webp'),
  thumbPlans: require('../../assets/images/scenes/thumb-plans.webp'),
  thumbFood: require('../../assets/images/scenes/thumb-food.webp'),
  thumbCardio: require('../../assets/images/scenes/thumb-cardio.webp'),
  thumbBody: require('../../assets/images/scenes/thumb-body.webp'),
  thumbMedication: require('../../assets/images/scenes/thumb-medication.webp'),
  thumbSupplement: require('../../assets/images/scenes/thumb-supplement.webp'),
  thumbInjectable: require('../../assets/images/scenes/thumb-injectable.webp'),
  thumbDiet: require('../../assets/images/scenes/thumb-diet.webp'),
  thumbGroups: require('../../assets/images/scenes/thumb-groups.webp'),
  thumbProfessional: require('../../assets/images/scenes/thumb-professional.webp'),
} as const;
export type SceneName = keyof typeof SceneImages;

/** Imagem decorativa que preenche o cartão pai (que deve ter overflow hidden). `dim` escurece tudo quando o texto ocupa a largura inteira; `align="top"` mantém o alto da cena quando o cartão é mais largo que a imagem. */
export function SceneBackdrop({ scene, dim = 0, align = 'center' }: { scene: SceneName; dim?: number; align?: 'center' | 'top' }) {
  // Below 360 px the text reaches the drawing; darken it enough for the copy to stay readable.
  const narrow = useWindowDimensions().width < 360;
  const shade = narrow ? Math.max(dim, .5) : dim;
  return <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={SceneImages[scene]} contentFit="cover" contentPosition={`right ${align}`} transition={0} style={StyleSheet.absoluteFill} accessible={false} />
    {shade ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(11,30,40,${shade})` }]} /> : null}
  </View>;
}

/** Miniatura quadrada de uma cena `thumb*`. Tamanho fixo e sem encolher, para a imagem nunca ser achatada numa linha apertada. */
export function SceneThumb({ scene, size = 40 }: { scene: SceneName; size?: number }) {
  const { colors: c } = useAppTheme();
  return <View aria-hidden pointerEvents="none" style={{ width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * .3), overflow: 'hidden', backgroundColor: c.primaryStrong }}>
    <Image source={SceneImages[scene]} contentFit="cover" transition={0} style={{ width: size, height: size }} accessible={false} />
  </View>;
}

/** Faixa ilustrada com texto curto à esquerda; não é interativa para não competir com as ações da tela. */
export function SceneBanner({ scene, eyebrow, title, text, height = 128, style, children }: PropsWithChildren<{ scene: SceneName; eyebrow?: string; title: string; text?: string; height?: number; style?: StyleProp<ViewStyle> }>) {
  const { colors: c } = useAppTheme();
  // On narrow phones the drawing would sit under the text: show a compact band without it.
  const narrow = useWindowDimensions().width < 360;
  return <View style={[styles.banner, { minHeight: narrow ? 0 : height, backgroundColor: c.primaryStrong }, style]}>
    {narrow ? null : <SceneBackdrop scene={scene} />}
    <View style={[styles.copy, narrow && styles.copyNarrow]}>
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
  copyNarrow: { maxWidth: '100%', paddingVertical: 14 },
  eyebrow: { ...Type.caption, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { ...Type.title, fontWeight: '800', letterSpacing: -0.3 },
  text: { ...Type.caption, marginTop: 2 },
});
