import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * uri is metadata from the authenticated catalog, never an editable form field. Without an image (or when it fails/offline) shows a generic illustration.
 * The frame is always 3:2 with the whole image contained on white (the photos' own background), so mixed source ratios never stretch or crop the movement.
 * `size` is the frame width; `fill` uses the available width up to 360 px.
 */
export function ExerciseThumbnail({ name, uri, size = 64, fill, onPreview }: { name: string; uri?: string | null; size?: number; fill?: boolean; onPreview?(uri: string): void }) {
  const { colors: c } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const frame = [fill ? { width: '100%' as const, maxWidth: 360, alignSelf: 'center' as const, borderRadius: 16 } : { width: size, borderRadius: Math.round(size / 6) }, { aspectRatio: 3 / 2, overflow: 'hidden' as const }];
  if (!uri || uri === failedUri) return <View accessibilityLabel={`Imagem ilustrativa de ${name}`} style={[frame, { backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }]}><MaterialCommunityIcons name="weight-lifter" size={fill ? 56 : Math.round(size * .4)} color={c.link}/></View>;
  const image = <View style={[frame, { backgroundColor: c.white }]}><Image source={{uri}} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailedUri(uri)} accessibilityLabel={`Imagem de ${name}`} style={{ width: '100%', height: '100%' }}/></View>;
  return onPreview ? <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar imagem de ${name}`} onPress={() => onPreview(uri)} style={fill ? { width: '100%' } : null}>{image}</Pressable> : image;
}
