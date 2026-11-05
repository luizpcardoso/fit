import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@/components/icon';
import { getWorkoutIllustration } from '@/constants/workout-illustrations';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

/** Artwork always uses its 4:3 canvas, with containment rather than a cropped body. */
export function WorkoutIllustration({ id, style }: { id?: string | null; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useAppTheme();
  const art = getWorkoutIllustration(id);
  const [failed, setFailed] = useState<string | null>(null);
  return <View style={[styles.frame, { backgroundColor: art ? c.white : c.surfaceSoft }, style]}>
    {art && failed !== art.id ? <Image source={art.source} contentFit="contain" style={styles.image} accessibilityLabel={`Ilustração de ${art.name}`} onError={() => setFailed(art.id)}/> : <MaterialCommunityIcons name="dumbbell" size={28} color={c.link}/>}
  </View>;
}
const styles = StyleSheet.create({
  frame: { aspectRatio: 4 / 3, borderRadius: Radius.md, padding: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
