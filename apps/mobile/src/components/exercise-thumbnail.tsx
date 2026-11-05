import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

/** uri is metadata from the authenticated catalog, never an editable form field. Without an image (or when it fails/offline) shows a generic illustration. `height` makes it full width; otherwise it is a `size` square. */
export function ExerciseThumbnail({ name, uri, size = 48, height, onPreview }: { name: string; uri?: string | null; size?: number; height?: number; onPreview?(uri: string): void }) {
  const { colors: c } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const style = height ? { width: '100%' as const, height, borderRadius: 16, backgroundColor: c.surfaceSoft } : { width: size, height: size, borderRadius: Math.round(size / 4), backgroundColor: c.surfaceSoft };
  if (!uri || uri === failedUri) return <View accessibilityLabel={`Imagem ilustrativa de ${name}`} style={[style, { backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }]}><MaterialCommunityIcons name="weight-lifter" size={height ? 56 : Math.round(size * .52)} color={c.link}/></View>;
  const image = <Image source={{uri}} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailedUri(uri)} accessibilityLabel={`Imagem de ${name}`} style={style}/>;
  return onPreview ? <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar imagem de ${name}`} onPress={() => onPreview(uri)}>{image}</Pressable> : image;
}
