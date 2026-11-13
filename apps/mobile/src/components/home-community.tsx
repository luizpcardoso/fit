import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { Type } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';
import { useGroupUpdates } from '@/components/group-updates-provider';
import { usePagedData } from '@/hooks/use-paged-data';

/** A small, read-only preview: opening Início never acknowledges posts or accepts invitations. */
export function HomeCommunity({ refreshSignal = 0 }: { /** Bumped by Início's pull-to-refresh. */ refreshSignal?: number }) {
  const { api, user } = useAuth();
  const { colors: c } = useAppTheme();
  const { pendingInvites, postsUnseen } = useGroupUpdates();
  const loadGroups = useCallback(() => api.listGroups(), [api]);
  const groups = usePagedData(`home-groups:${user?.id}`, loadGroups);
  const { refresh: refreshGroups } = groups;
  const previousUnread = useRef(postsUnseen);
  useEffect(() => {
    if (previousUnread.current === postsUnseen) return;
    previousUnread.current = postsUnseen;
    void refreshGroups();
  }, [postsUnseen, refreshGroups]);
  const loadInvites = useCallback(() => api.listGroupInvites(), [api]);
  const invites = usePagedData(`home-invites:${user?.id}`, loadInvites);
  const { refresh: refreshInvites } = invites;
  const previousInvites = useRef(pendingInvites);
  useEffect(() => {
    if (previousInvites.current === pendingInvites) return;
    previousInvites.current = pendingInvites;
    void refreshInvites();
  }, [pendingInvites, refreshInvites]);
  const lastSignal = useRef(refreshSignal);
  useEffect(() => {
    if (lastSignal.current === refreshSignal) return;
    lastSignal.current = refreshSignal;
    void refreshGroups(); void refreshInvites();
  }, [refreshSignal, refreshGroups, refreshInvites]);
  const joined = (groups.data ?? []).filter(group => group.active);
  const unread = joined.filter(group => group.unseenCount > 0).sort((a, b) => b.unseenCount - a.unseenCount || a.name.localeCompare(b.name, 'pt-BR'));
  const pending = invites.data?.filter(item => item.status === 'pending');
  const invite = pending?.[0];
  const inviteCount = pending?.length ?? pendingInvites;
  const hasInvites = inviteCount > 0;
  const failed = Boolean(groups.error || invites.error);
  const refresh = () => { void groups.refresh(); void invites.refresh(); };
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 64, paddingVertical: 10 };
  return <View testID="home-community" style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Text accessibilityRole="header" style={{ ...Type.title, color: c.text, fontWeight: '800' }}>Comunidade</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir comunidade" onPress={() => router.push('/groups')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Ver tudo</Text></Pressable>
    </View>
    <View style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
      {(groups.loading && !groups.data) || (invites.loading && !invites.data) ? <View style={rowStyle}><ActivityIndicator color={c.link} accessibilityLabel="Carregando comunidade"/><Text style={{ ...Type.body, color: c.textMuted }}>Buscando seus grupos…</Text></View> : null}
      {hasInvites ? <Pressable accessibilityRole="button" accessibilityLabel={inviteCount > 1 ? `Ver ${inviteCount} convites` : 'Ver convite'} onPress={() => router.push('/social-groups')} style={rowStyle}>
        <GroupAvatar name={invite?.group.name ?? 'Convite'} url={invite?.group.avatarUrl} invite/>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ ...Type.body, color: c.text, fontWeight: '700' }}>{invite ? `Convite · ${invite.group.name}` : `${inviteCount === 1 ? 'Um convite' : `${inviteCount} convites`} para você`}</Text>
          <Text style={{ ...Type.caption, color: c.textMuted }}>{invite ? `${invite.invitedBy.displayName} convidou você${inviteCount > 1 ? ` · mais ${inviteCount - 1}` : ''}` : 'Conheça o grupo e escolha se quer participar.'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/>
      </Pressable> : null}
      {unread.slice(0, 2).map(group => <Pressable key={group.id} accessibilityRole="button" accessibilityLabel={`Abrir ${group.name}, ${group.unseenCount} ${group.unseenCount === 1 ? 'publicação não lida' : 'publicações não lidas'}`}
        onPress={() => router.push({ pathname: '/group-detail', params: { id: group.id } })} style={[rowStyle, hasInvites && { borderTopWidth: 1, borderTopColor: c.border }]}>
        <GroupAvatar name={group.name} url={group.avatarUrl}/>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ ...Type.body, color: c.text, fontWeight: '700' }}>{group.name}</Text><Text style={{ ...Type.caption, color: c.textMuted }}>{group.unseenCount} {group.unseenCount === 1 ? 'publicação não lida' : 'publicações não lidas'}</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/>
      </Pressable>)}
      {unread.length > 2 ? <Pressable accessibilityRole="button" onPress={() => router.push('/groups')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Ver novidades de mais {unread.length - 2} {unread.length === 3 ? 'grupo' : 'grupos'}</Text></Pressable> : null}
      {groups.data && invites.data && !failed && !unread.length && !hasInvites ? <Pressable accessibilityRole="button" accessibilityLabel={joined.length ? 'Abrir meus grupos' : 'Conhecer comunidade'} onPress={() => router.push(joined.length ? '/social-groups' : '/groups')} style={rowStyle}>
        <GroupAvatar name="Comunidade"/>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ ...Type.body, color: c.text, fontWeight: '700' }}>{joined.length ? 'Seus grupos estão em dia' : 'Sua comunidade começa aqui'}</Text>
          <Text style={{ ...Type.caption, color: c.textMuted }}>{joined.length ? `${joined.length} ${joined.length === 1 ? 'grupo' : 'grupos'} · Ver meus grupos` : 'Crie um grupo privado ou participe por convite.'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/>
      </Pressable> : null}
      {failed ? <View style={{ paddingVertical: 10, gap: 4 }}><Text accessibilityRole="alert" style={{ ...Type.caption, color: c.textMuted }}>{groups.data ? 'Não foi possível atualizar a comunidade. Exibindo os últimos dados.' : 'Comunidade indisponível no momento. Confira sua conexão.'}</Text><Pressable accessibilityRole="button" onPress={refresh} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Tentar novamente</Text></Pressable></View> : null}
    </View>
  </View>;
}

function GroupAvatar({ name, url, invite = false }: { name: string; url?: string | null; invite?: boolean }) {
  const { colors: c } = useAppTheme();
  return <View aria-hidden style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <MaterialCommunityIcons name={invite ? 'email-outline' : 'account-group-outline'} size={23} color={c.link}/>
    {url ? <Image source={{ uri: url }} accessibilityLabel={name} style={{ position: 'absolute', width: 42, height: 42 }} contentFit="cover"/> : null}
  </View>;
}
