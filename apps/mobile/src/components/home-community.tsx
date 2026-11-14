import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import type { GroupReaction, SocialPost } from '@fit/contracts';
import { Pressable } from '@/components/pressable';
import { ReactionControl, myReaction, withMyReaction, type ReactionCount } from '@/components/reaction-control';
import { showToast } from '@/components/app-dialog';
import { groupErrorMessage, peopleSummary, trainedToday } from '@/utils/groups';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { Type } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';
import { useGroupUpdates } from '@/components/group-updates-provider';
import { usePagedData } from '@/hooks/use-paged-data';

/**
 * Community on Início: who trained today, the latest posts and pending invitations.
 * Looking at it never marks posts as read; reacting and accepting an invitation only happen on an explicit tap.
 */
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
  // The same first page the feed shows; a failure here only hides the preview, never the groups below.
  const loadFeed = useCallback(() => api.listSocialFeed(), [api]);
  const feed = usePagedData(`home-feed:${user?.id}`, loadFeed);
  const { refresh: refreshFeed } = feed;
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, ReactionCount[]>>({});
  const reacting = useRef(new Set<string>());
  const [accepting, setAccepting] = useState(false);
  const lastSignal = useRef(refreshSignal);
  useEffect(() => {
    if (lastSignal.current === refreshSignal) return;
    lastSignal.current = refreshSignal;
    void refreshGroups(); void refreshInvites(); void refreshFeed();
  }, [refreshSignal, refreshGroups, refreshInvites, refreshFeed]);
  const joined = (groups.data ?? []).filter(group => group.active);
  const unread = joined.filter(group => group.unseenCount > 0).sort((a, b) => b.unseenCount - a.unseenCount || a.name.localeCompare(b.name, 'pt-BR'));
  const pending = invites.data?.filter(item => item.status === 'pending');
  const invite = pending?.[0];
  const inviteCount = pending?.length ?? pendingInvites;
  const hasInvites = inviteCount > 0;
  const failed = Boolean(groups.error || invites.error);
  const refresh = () => { void groups.refresh(); void invites.refresh(); void feed.refresh(); };
  const posts = feed.data?.items ?? [];
  const trained = trainedToday(posts, user?.id);
  const recent = posts.filter(post => post.author.id !== user?.id).slice(0, 2);
  const countsOf = (post: SocialPost) => reactionOverrides[post.id] ?? post.reactionCounts;
  const react = async (post: SocialPost, reaction: GroupReaction) => {
    if (reacting.current.has(post.id)) return;
    reacting.current.add(post.id);
    const before = countsOf(post), next = myReaction(before) === reaction ? null : reaction;
    setReactionOverrides(current => ({ ...current, [post.id]: withMyReaction(before, next) }));
    try { await api.reactToGroupPost(post.groupId, post.id, next); }
    catch (failure) { setReactionOverrides(current => ({ ...current, [post.id]: before })); showToast(groupErrorMessage(failure, { network: 'Reação não enviada. Confira sua conexão e tente novamente.' }), 'error'); }
    finally { reacting.current.delete(post.id); }
  };
  const accept = async () => {
    if (!invite || accepting) return;
    setAccepting(true);
    try { await api.decideGroupInvite(invite.id, 'accepted'); showToast(`Você entrou em ${invite.group.name}.`); await Promise.all([groups.refresh(), invites.refresh(), feed.refresh()]); }
    catch (failure) { showToast(groupErrorMessage(failure, { conflict: 'Este convite não está mais disponível.', not_found: 'Este convite não está mais disponível.' }), 'error'); void invites.refresh(); }
    finally { setAccepting(false); }
  };
  const openGroup = (groupId: string) => router.push({ pathname: '/group-detail', params: { id: groupId } });
  const postPreview = (post: SocialPost) => post.text?.trim() || (post.photoUrl ? 'Publicou uma foto' : 'Nova publicação');
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 64, paddingVertical: 10 };
  return <View testID="home-community" style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Text accessibilityRole="header" style={{ ...Type.title, color: c.text, fontWeight: '800' }}>Comunidade</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir comunidade" onPress={() => router.push('/groups')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Ver tudo</Text></Pressable>
    </View>
    {trained.length ? <View testID="home-community-trained" style={{ backgroundColor: c.primarySoft, borderRadius: 20, paddingVertical: 12, gap: 8 }}>
      <Text style={{ ...Type.label, color: c.text, fontWeight: '800', paddingHorizontal: 16 }}>{peopleSummary(trained.map(item => item.user.displayName))} {trained.length === 1 ? 'treinou' : 'treinaram'} hoje</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {trained.map(({ user: person, post }) => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`${person.displayName} treinou hoje. Abrir ${post.group.name}`} onPress={() => openGroup(post.groupId)} style={{ width: 60, alignItems: 'center', gap: 4 }}>
          <Face name={person.displayName} url={person.avatarUrl} ring/>
          <Text numberOfLines={1} style={{ ...Type.caption, color: c.text, maxWidth: 60 }}>{person.displayName.trim().split(/\s+/)[0]}</Text>
        </Pressable>)}
      </ScrollView>
    </View> : null}
    {recent.map(post => <View key={post.id} testID={`home-community-post-${post.id}`} style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 20, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 6, gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir publicação de ${post.author.displayName} em ${post.group.name}`} onPress={() => openGroup(post.groupId)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Face name={post.author.displayName} url={post.author.avatarUrl}/>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={{ ...Type.label, color: c.text, fontWeight: '800' }}>{post.author.displayName} <Text style={{ color: c.textMuted, fontWeight: '400' }}>· {post.group.name}</Text></Text>
          <Text numberOfLines={2} style={{ ...Type.body, color: c.text }}>{postPreview(post)}</Text>
        </View>
      </Pressable>
      <ReactionControl counts={countsOf(post)} onReact={reaction => void react(post, reaction)}/>
    </View>)}
    <View style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
      {(groups.loading && !groups.data) || (invites.loading && !invites.data) ? <View style={rowStyle}><ActivityIndicator color={c.link} accessibilityLabel="Carregando comunidade"/><Text style={{ ...Type.body, color: c.textMuted }}>Buscando seus grupos…</Text></View> : null}
      {hasInvites ? <View style={rowStyle}>
        <Pressable accessibilityRole="button" accessibilityLabel={inviteCount > 1 ? `Ver ${inviteCount} convites` : 'Ver convite'} onPress={() => router.push('/social-groups')} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <GroupAvatar name={invite?.group.name ?? 'Convite'} url={invite?.group.avatarUrl} invite/>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ ...Type.body, color: c.text, fontWeight: '700' }}>{invite ? `Convite · ${invite.group.name}` : `${inviteCount === 1 ? 'Um convite' : `${inviteCount} convites`} para você`}</Text>
            <Text style={{ ...Type.caption, color: c.textMuted }}>{invite ? `${invite.invitedBy.displayName} convidou você${inviteCount > 1 ? ` · mais ${inviteCount - 1}` : ''}` : 'Conheça o grupo e escolha se quer participar.'}</Text>
          </View>
        </Pressable>
        {invite ? <Pressable accessibilityRole="button" accessibilityLabel={`Aceitar convite para ${invite.group.name}`} aria-busy={accepting} disabled={accepting} onPress={() => void accept()} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: accepting ? .6 : 1 }}>{accepting ? <ActivityIndicator color={c.onPrimary} size="small"/> : <Text style={{ ...Type.label, color: c.onPrimary, fontWeight: '800' }}>Aceitar</Text>}</Pressable> : <MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/>}
      </View> : null}
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

/** Plain person avatar (photo or initial); `ring` marks someone active today. */
function Face({ name, url, ring = false }: { name: string; url?: string | null; ring?: boolean }) {
  const { colors: c } = useAppTheme();
  return <View aria-hidden style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: ring ? 2 : 0, borderColor: c.accent }}>
    <Text style={{ ...Type.body, color: c.link, fontWeight: '800' }}>{name.trim().slice(0, 1).toUpperCase()}</Text>
    {url ? <Image source={{ uri: url }} style={{ position: 'absolute', width: 44, height: 44 }} contentFit="cover"/> : null}
  </View>;
}
