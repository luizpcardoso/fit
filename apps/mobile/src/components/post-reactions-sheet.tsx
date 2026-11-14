import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/bottom-sheet';
import { Pressable } from '@/components/pressable';
import type { GroupPostReaction } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { reactions } from '@/components/reaction-control';
import { SocialAvatar } from '@/components/social-avatar';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { groupErrorMessage } from '@/utils/groups';

/** Bottom sheet listing who reacted to a post. The API only answers for posts the viewer can read. */
export function PostReactionsSheet({ target, onClose }: { target: { groupId: string; postId: string } | null; onClose(): void }) {
  const { colors: c } = useAppTheme(), s = styles(c), { api } = useAuth();
  const [items, setItems] = useState<GroupPostReaction[] | null>(null);
  const [error, setError] = useState('');
  const groupId = target?.groupId, postId = target?.postId;
  const [attempt, setAttempt] = useState(0);
  // The parent remounts this sheet per post (key), so the list always starts clean.
  useEffect(() => {
    if (!groupId || !postId) return;
    let active = true;
    api.listGroupPostReactions(groupId, postId)
      .then(result => { if (active) { setItems(result); setError(''); } })
      .catch(failure => { if (active) setError(groupErrorMessage(failure, { not_found: 'Esta publicação não está mais disponível.' })); });
    return () => { active = false; };
  }, [api, groupId, postId, attempt]);
  const close = onClose;
  return <BottomSheet visible={Boolean(target)} onClose={close} title={`Reações${items?.length ? ` (${items.length})` : ''}`} testID="post-reactions-sheet" backdropLabel="Fechar reações">
    {!items && !error ? <ActivityIndicator accessibilityLabel="Carregando reações" color={c.link} style={s.state}/> : null}
    {error ? <View style={s.error}>
      <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setError(''); setAttempt(value => value + 1); }} style={s.retry}><Text style={s.link}>Tentar novamente</Text></Pressable>
    </View> : null}
    {items && !error && !items.length ? <Text style={[s.muted, s.state]}>Ninguém reagiu ainda.</Text> : null}
    {!error ? items?.map(item => {
      const reaction = reactions.find(option => option.key === item.reaction);
      return <View key={item.user.id} style={s.row} accessible accessibilityLabel={`${item.user.displayName}: ${reaction?.label ?? 'reagiu'}`}>
        <SocialAvatar name={item.user.displayName} url={item.user.avatarUrl} size={36}/>
        <Text numberOfLines={1} style={s.name}>{item.user.displayName}</Text>
        <Text style={s.emoji}>{reaction?.emoji}</Text>
        <Text style={s.muted}>{reaction?.label}</Text>
      </View>;
    }) : null}
  </BottomSheet>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  state: { paddingVertical: 24, textAlign: 'center' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { ...Type.body, flex: 1, minWidth: 0, fontWeight: '700', color: c.text },
  emoji: { fontSize: 18 },
  muted: { ...Type.caption, color: c.textMuted },
  error: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12, gap: 4 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { ...Type.body, color: c.link, fontWeight: '800' },
});
