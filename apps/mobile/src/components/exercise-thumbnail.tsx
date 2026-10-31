import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

/** uri is metadata from the authenticated catalog, never an editable form field. */
export function ExerciseThumbnail({ name, uri, onPreview }: { name: string; uri?: string | null; onPreview(uri: string): void }) {
  const { colors: c } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const style = { width: 48, height: 48, borderRadius: 12, backgroundColor: c.surfaceSoft };
  if (!uri || uri === failedUri) return <View accessibilityLabel={`Sem imagem de ${name}`} style={[style, { alignItems: 'center', justifyContent: 'center' }]}><MaterialCommunityIcons name="dumbbell" size={23} color={c.textMuted}/></View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar imagem de ${name}`} onPress={() => onPreview(uri)}>
    <Image source={{uri}} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailedUri(uri)} style={style}/>
  </Pressable>;
}
