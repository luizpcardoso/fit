import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { GroupJoinPreview } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { showToast } from '@/components/app-dialog';
import { FormInput } from '@/components/form-input';
import { FormScrollView } from '@/components/form-scroll-view';
import MaterialCommunityIcons from '@/components/icon';
import { Pressable } from '@/components/pressable';
import { FixedScreenHeader } from '@/components/screen-header';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { groupErrorMessage } from '@/utils/groups';

const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/** Join a private group with a code: the person sees the group's name, asks to join and waits for the administration. */
export default function GroupJoin() {
  const { colors: c, scheme } = useAppTheme(), s = styles(c), { api } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => clean(params.code ?? ''));
  const [preview, setPreview] = useState<{ code: string; data: GroupJoinPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const find = useCallback(async (value: string) => {
    if (value.length !== 10) { setError('O código tem 10 letras e números.'); return; }
    setBusy(true); setError('');
    try { setPreview({ code: value, data: await api.previewGroupJoin(value) }); }
    catch (failure) { setPreview(null); setError(groupErrorMessage(failure, { not_found: 'Código inválido, vencido ou desativado. Peça um novo a quem convidou você.', invalid: 'Confira o código: são 10 letras e números.' })); }
    finally { setBusy(false); }
  }, [api]);
  // A code that arrives by link is looked up at once.
  const initial = clean(params.code ?? '');
  useEffect(() => {
    if (initial.length !== 10) return;
    let active = true;
    api.previewGroupJoin(initial).then(data => { if (active) setPreview({ code: initial, data }); }, failure => { if (active) setError(groupErrorMessage(failure, { not_found: 'Código inválido, vencido ou desativado. Peça um novo a quem convidou você.' })); });
    return () => { active = false; };
  }, [api, initial]);
  const request = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try { await api.requestGroupJoin(preview.code); setPreview({ ...preview, data: { ...preview.data, status: 'pending' } }); showToast('Pedido enviado. Você será avisado quando for respondido.'); }
    catch (failure) { setError(groupErrorMessage(failure, { conflict: 'Você já participa deste grupo ou já tem um pedido aguardando resposta.', not_found: 'Este código não está mais disponível.' })); }
    finally { setBusy(false); }
  };
  const shown = preview && preview.code === code ? preview.data : null;
  return <SafeAreaView style={s.safe} edges={['top']}>
    <FixedScreenHeader backLabel="Meus grupos"/>
    <FormScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text accessibilityRole="header" style={s.title}>Entrar com código</Text>
      <Text style={s.muted}>Digite o código que você recebeu. Os grupos são privados: você pede para entrar e a administração do grupo aprova.</Text>
      <FormInput accessibilityLabel="Código do grupo" keyboardAppearance={scheme} value={code} onChangeText={value => { setCode(clean(value)); setError(''); }} onSubmitEditing={() => void find(code)} autoCapitalize="characters" autoCorrect={false} maxLength={10} placeholder="Ex.: ABCDE23456" placeholderTextColor={c.textMuted} style={s.input}/>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {!shown ? <Pressable accessibilityRole="button" aria-busy={busy} disabled={busy || code.length !== 10} onPress={() => void find(code)} style={[s.primary, (busy || code.length !== 10) && s.disabled]}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={s.primaryText}>Buscar grupo</Text>}</Pressable> : null}
      {shown ? <View style={s.card} testID="group-join-preview">
        <View style={s.cardTop}><View style={s.icon}><MaterialCommunityIcons name="account-group" size={24} color={c.link}/></View><View style={s.flex}><Text style={s.cardTitle}>{shown.group.name}</Text><Text style={s.muted}>{shown.group.memberCount} {shown.group.memberCount === 1 ? 'membro' : 'membros'} · grupo privado</Text></View></View>
        {shown.status === 'available' ? <>
          <Text style={s.muted}>Ao pedir para entrar, a administração vê seu nome e sua foto de perfil. Você só acessa as publicações depois de aprovado, e apenas as feitas a partir da sua entrada.</Text>
          <Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} onPress={() => void request()} style={[s.primary, busy && s.disabled]}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={s.primaryText}>Pedir para entrar</Text>}</Pressable>
        </> : shown.status === 'pending' ? <View style={s.notice}><MaterialCommunityIcons name="clock-outline" size={20} color={c.link}/><Text style={[s.muted, s.flex]}>Pedido enviado. Você recebe uma notificação quando a administração responder.</Text></View>
          : <><View style={s.notice}><MaterialCommunityIcons name="check-circle-outline" size={20} color={c.success}/><Text style={[s.muted, s.flex]}>Você já participa deste grupo.</Text></View><Pressable accessibilityRole="button" onPress={() => router.dismissTo('/social-groups')} style={s.secondary}><Text style={s.link}>Ver meus grupos</Text></Pressable></>}
      </View> : null}
    </FormScrollView>
  </SafeAreaView>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 },
  content: { padding: 20, gap: 14, maxWidth: 600, width: '100%', alignSelf: 'center' },
  title: { ...Type.headline, fontWeight: '800', color: c.text }, muted: { ...Type.label, color: c.textMuted },
  input: { minHeight: 56, borderWidth: 1, borderColor: c.fieldBorder, borderRadius: Radius.lg, paddingHorizontal: 16, backgroundColor: c.surface, color: c.text, ...Type.title, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  error: { ...Type.label, color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: Radius.md },
  primary: { minHeight: 52, borderRadius: Radius.lg, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { ...Type.body, color: c.onPrimary, fontWeight: '800' },
  secondary: { minHeight: 48, borderRadius: Radius.md, backgroundColor: c.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  link: { ...Type.body, color: c.link, fontWeight: '800' },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Type.bodyLarge, fontWeight: '800', color: c.text },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.lg, backgroundColor: c.surfaceSoft },
  disabled: { opacity: .5 },
});
