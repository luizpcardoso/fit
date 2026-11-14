import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import type { GroupInviteLink, GroupJoinRequest } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { confirmAction, showToast } from '@/components/app-dialog';
import MaterialCommunityIcons from '@/components/icon';
import { Pressable } from '@/components/pressable';
import { SocialAvatar } from '@/components/social-avatar';
import { CardShadow, Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { formatShortDate, localDate } from '@/utils/dates';
import { groupErrorMessage } from '@/utils/groups';

/**
 * Administration only: one code per group, valid for 7 days. Whoever uses it asks to join and waits here for approval;
 * the code is shown once, when created, because the server keeps only its hash.
 */
export function GroupJoinAdmin({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { colors: c } = useAppTheme(), s = styles(c), { api } = useAuth();
  const [link, setLink] = useState<GroupInviteLink | null>(null);
  const [code, setCode] = useState('');
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([api.getGroupInviteLink(groupId), api.listGroupJoinRequests(groupId)])
      .then(([current, pending]) => { if (active) { setLink(current); setRequests(pending); setError(''); } })
      .catch(failure => { if (active) setError(groupErrorMessage(failure, { server: 'Não foi possível carregar o convite por código.' })); });
    return () => { active = false; };
  }, [api, groupId, attempt]);
  const run = useCallback(async (key: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setError('');
    try { await work(); } catch (failure) { setError(groupErrorMessage(failure, { conflict: 'Este pedido já foi respondido.', not_found: 'Este pedido não está mais disponível.' })); setAttempt(value => value + 1); }
    finally { setBusy(''); }
  }, [busy]);
  const create = async () => {
    if (link?.active && !(await confirmAction({ title: 'Gerar novo código?', message: 'O código atual deixa de valer. Pedidos já enviados continuam aguardando sua resposta.', confirmLabel: 'Gerar novo código' }))) return;
    await run('create', async () => { const created = await api.createGroupInviteLink(groupId); setLink({ active: true, expiresAt: created.expiresAt }); setCode(created.code ?? ''); });
  };
  const revoke = async () => {
    if (!(await confirmAction({ title: 'Desativar código?', message: 'Ninguém mais poderá pedir para entrar com ele. Pedidos já enviados continuam aguardando sua resposta.', confirmLabel: 'Desativar código', destructive: true }))) return;
    await run('revoke', async () => { await api.revokeGroupInviteLink(groupId); setLink({ active: false, expiresAt: null }); setCode(''); showToast('Código desativado.'); });
  };
  const share = async () => {
    const message = `Entre no grupo “${groupName}” no Orami: em Comunidade → Meus grupos → Entrar com código, digite ${code}. No celular com o app instalado: fit://group-join?code=${code}`;
    try { await Share.share({ message }); } catch { showToast('Não foi possível abrir o compartilhamento. Copie o código exibido.', 'error'); }
  };
  const decide = async (request: GroupJoinRequest, decision: 'approved' | 'declined') => {
    if (decision === 'declined' && !(await confirmAction({ title: 'Recusar pedido?', message: `${request.user.displayName} não entrará no grupo e será avisado de que o pedido não foi aceito.`, confirmLabel: 'Recusar pedido', destructive: true }))) return;
    await run(request.id, async () => {
      await api.decideGroupJoinRequest(groupId, request.id, decision);
      setRequests(current => current.filter(item => item.id !== request.id));
      showToast(decision === 'approved' ? `${request.user.displayName} entrou no grupo.` : 'Pedido recusado.');
    });
  };
  const expires = link?.expiresAt ? formatShortDate(localDate(new Date(link.expiresAt))) : '';
  return <View style={[s.card, CardShadow]} testID="group-join-admin">
    <View>
      <Text style={s.title}>Convite por código</Text>
      <Text style={s.subtitle}>Quem usar o código pede para entrar; a entrada só acontece com a sua aprovação.</Text>
    </View>
    {!link && !error ? <ActivityIndicator accessibilityLabel="Carregando convite por código" color={c.link}/> : null}
    {error ? <View style={s.error}><Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setError(''); setAttempt(value => value + 1); }} style={s.inline}><Text style={s.link}>Tentar novamente</Text></Pressable></View> : null}
    {code ? <View style={s.codeBox}>
      <Text accessibilityLabel={`Código do grupo: ${code.split('').join(' ')}`} selectable style={s.code}>{code}</Text>
      <Text style={s.caption}>Válido até {expires}. Compartilhe agora: por segurança, o código não é exibido de novo.</Text>
      <Pressable accessibilityRole="button" onPress={() => void share()} style={s.primary}><MaterialCommunityIcons name="share-variant-outline" size={20} color={c.onPrimary}/><Text style={s.primaryText}>Compartilhar código</Text></Pressable>
    </View> : link?.active ? <Text style={s.caption}>Há um código ativo até {expires}. Para compartilhar de novo, gere um novo código; o atual deixa de valer.</Text> : link ? <Text style={s.caption}>Nenhum código ativo. Gere um para convidar pessoas sem precisar do @usuário de cada uma.</Text> : null}
    {link ? <View style={s.actions}>
      <Pressable accessibilityRole="button" aria-busy={busy === 'create'} disabled={Boolean(busy)} onPress={() => void create()} style={[s.secondary, Boolean(busy) && s.disabled]}>{busy === 'create' ? <ActivityIndicator color={c.link}/> : <Text style={s.link}>{link.active ? 'Gerar novo código' : 'Gerar código'}</Text>}</Pressable>
      {link.active ? <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void revoke()} style={[s.secondary, Boolean(busy) && s.disabled]}><Text style={s.danger}>Desativar código</Text></Pressable> : null}
    </View> : null}
    {requests.length ? <View style={s.requests}>
      <Text accessibilityRole="header" style={s.requestsTitle}>Pedidos para entrar ({requests.length})</Text>
      {requests.map(request => <View key={request.id} style={s.request}>
        <SocialAvatar name={request.user.displayName} url={request.user.avatarUrl} size={36}/>
        <View style={s.flex}><Text numberOfLines={1} style={s.name}>{request.user.displayName}</Text>{request.user.username ? <Text numberOfLines={1} style={s.caption}>@{request.user.username}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Aprovar pedido de ${request.user.displayName}`} aria-busy={busy === request.id} disabled={Boolean(busy)} onPress={() => void decide(request, 'approved')} style={[s.approve, Boolean(busy) && s.disabled]}><Text style={s.primaryText}>Aprovar</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Recusar pedido de ${request.user.displayName}`} disabled={Boolean(busy)} onPress={() => void decide(request, 'declined')} style={[s.decline, Boolean(busy) && s.disabled]}><MaterialCommunityIcons name="close" size={20} color={c.danger}/></Pressable>
      </View>)}
    </View> : null}
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, padding: 15, gap: 12 },
  title: { color: c.text, fontSize: 17, fontWeight: '800' }, subtitle: { ...Type.caption, color: c.textMuted, marginTop: 2 },
  caption: { ...Type.caption, color: c.textMuted },
  codeBox: { gap: 10, padding: 14, borderRadius: Radius.lg, backgroundColor: c.primarySoft },
  code: { ...Type.headline, fontWeight: '800', letterSpacing: 4, color: c.text, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { minHeight: 48, borderRadius: Radius.lg, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  primaryText: { ...Type.label, color: c.onPrimary, fontWeight: '800' },
  secondary: { minHeight: 44, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: c.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  link: { ...Type.label, color: c.link, fontWeight: '800' }, danger: { ...Type.label, color: c.danger, fontWeight: '800' },
  inline: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  error: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12, gap: 4 },
  requests: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  requestsTitle: { ...Type.body, fontWeight: '800', color: c.text },
  request: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { ...Type.body, fontWeight: '700', color: c.text },
  approve: { minHeight: 44, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  decline: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .5 },
});
