import MaterialCommunityIcons from '@/components/icon';
import type { GroupUser } from '@fit/contracts';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { confirmAction, showToast } from '@/components/app-dialog';
import { ScreenHeader } from '@/components/screen-header';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

/** Lets people review and undo "Ocultar este usuário" from group feeds. */
export default function BlockedUsers() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const [items, setItems] = useState<GroupUser[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api.listBlockedUsers()
    .then(list => { setItems(list); setError(''); })
    .catch(() => setError('Não foi possível carregar as pessoas ocultadas.')), [api]);
  useEffect(() => { void load(); }, [load]);
  const unhide = async (person: GroupUser) => {
    const name = person.displayName ?? `@${person.username}`;
    if (!await confirmAction({ title: `Mostrar ${name} novamente?`, message: 'As publicações e os comentários dessa pessoa voltarão a aparecer nos grupos em comum. Ela não é avisada.', confirmLabel: 'Mostrar novamente' })) return;
    setBusy(person.id);
    try {
      await api.setUserBlocked(person.id, false);
      setItems(current => current?.filter(item => item.id !== person.id) ?? null);
      showToast(`${name} voltará a aparecer nos grupos.`);
    } catch { showToast('Não foi possível desfazer agora. Tente novamente.', 'error'); }
    finally { setBusy(''); }
  };
  return <SafeAreaView style={s.safe} edges={['top']}>
    <FlatList
      data={items ?? []}
      keyExtractor={item => item.id}
      contentContainerStyle={s.content}
      ListHeaderComponent={<View style={s.header}>
        <ScreenHeader backLabel="Configurações" />
        <Text accessibilityRole="header" style={s.title}>Pessoas ocultadas</Text>
        <Text style={s.subtitle}>Você não vê publicações nem comentários dessas pessoas nos grupos. Elas não são avisadas.</Text>
        {error ? <View style={s.notice}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={s.retry}><Text style={s.link}>Tentar novamente</Text></Pressable>
        </View> : null}
        {items === null && !error ? <ActivityIndicator color={c.link} accessibilityLabel="Carregando pessoas ocultadas" /> : null}
      </View>}
      ListEmptyComponent={items && !error ? <View style={s.empty}>
        <MaterialCommunityIcons name="account-check-outline" size={32} color={c.link} />
        <Text style={s.emptyTitle}>Ninguém ocultado</Text>
        <Text style={s.subtitle}>Para ocultar alguém, use o menu de uma publicação no grupo.</Text>
      </View> : undefined}
      renderItem={({ item }) => {
        const name = item.displayName ?? `@${item.username}`;
        return <View style={s.row}>
          {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={s.avatar} accessibilityIgnoresInvertColors /> : <View style={s.avatar}><Text style={s.initial}>{name.replace('@', '').charAt(0).toLocaleUpperCase('pt-BR')}</Text></View>}
          <View style={s.copy}>
            <Text style={s.name}>{name}</Text>
            {item.username ? <Text style={s.username}>@{item.username}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Mostrar ${name} novamente`} disabled={Boolean(busy)} onPress={() => void unhide(item)} style={s.action}>
            {busy === item.id ? <ActivityIndicator color={c.link} /> : <Text style={s.link}>Mostrar</Text>}
          </Pressable>
        </View>;
      }}
    />
  </SafeAreaView>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingBottom: 60, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: 10, marginBottom: 8 },
  title: { ...Type.display, fontWeight: '800', color: c.text },
  subtitle: { ...Type.label, color: c.textMuted },
  notice: { gap: 4 },
  error: { ...Type.label, color: c.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { ...Type.body, fontWeight: '700', color: c.link },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { ...Type.bodyLarge, fontWeight: '800', color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { ...Type.body, fontWeight: '800', color: c.onPrimarySoft },
  copy: { flex: 1, minWidth: 0 },
  name: { ...Type.body, fontWeight: '700', color: c.text },
  username: { ...Type.caption, color: c.textMuted },
  action: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
