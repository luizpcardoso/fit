import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

/** Uses the author's existing public avatar URL; never requests additional profile data. */
export function SocialAvatar({ name, url, size = 42 }: { name: string; url?: string | null; size?: number }) {
  const { colors: c } = useAppTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const hasPhoto = Boolean(url && url !== failedUrl);
  const initial = name.trim().slice(0, 1).toUpperCase();
  const thumbnail = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.link, fontWeight: '800', fontSize: Math.max(12, size * 0.4) }}>{initial}</Text>
      {hasPhoto ? <Image
        testID="social-avatar-image"
        accessibilityLabel={`Foto de perfil de ${name}`}
        source={{ uri: url! }}
        recyclingKey={url!}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        onError={() => setFailedUrl(url!)}
      /> : null}
    </View>
  );
  return <>
    {hasPhoto ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ampliar foto de ${name}`}
      onPress={() => { setPreviewState('loading'); setAttempt(0); setPreviewUrl(url!); }}
      style={styles.touchTarget}
    >{thumbnail}</Pressable> : <View style={styles.touchTarget}>{thumbnail}</View>}
    <Modal visible={previewUrl !== null} animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ flex: 1, color: c.text, fontSize: 18, fontWeight: '800' }}>Foto de {name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar foto de perfil" onPress={() => setPreviewUrl(null)} style={styles.touchTarget}>
            <MaterialCommunityIcons name="close" size={24} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.preview}>
          {previewUrl && previewState !== 'error' ? <Image
            key={`${previewUrl}-${attempt}`}
            testID="social-avatar-preview"
            accessibilityLabel={`Foto ampliada de ${name}`}
            source={{ uri: previewUrl }}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
            onLoad={() => setPreviewState('ready')}
            onError={() => setPreviewState('error')}
          /> : null}
          {previewState === 'loading' ? <ActivityIndicator accessibilityLabel="Carregando foto de perfil" color={c.link} /> : null}
          {previewState === 'error' ? <View style={styles.error}>
            <Text accessibilityRole="alert" style={{ color: c.text, textAlign: 'center' }}>Não foi possível carregar a foto.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar foto novamente" onPress={() => { setAttempt(value => value + 1); setPreviewState('loading'); }} style={styles.retry}>
              <Text style={{ color: c.link, fontWeight: '700' }}>Tentar novamente</Text>
            </Pressable>
          </View> : null}
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  touchTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  preview: { flex: 1, margin: 16, alignItems: 'center', justifyContent: 'center' },
  error: { gap: 8, padding: 16, alignItems: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
