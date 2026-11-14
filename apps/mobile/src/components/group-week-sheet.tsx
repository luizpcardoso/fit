import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import type { GroupWeekSummary } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { showToast } from '@/components/app-dialog';
import { BottomSheet } from '@/components/bottom-sheet';
import { Pressable } from '@/components/pressable';
import { SocialAvatar } from '@/components/social-avatar';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { formatShortDate, localDate } from '@/utils/dates';
import { groupErrorMessage } from '@/utils/groups';

/** The group's week: what was shared in it and the ranking of members who chose to take part. */
export function GroupWeekSheet({ groupId, visible, onClose }: { groupId: string; visible: boolean; onClose(): void }) {
  const { colors: c } = useAppTheme(), s = styles(c), { api, user } = useAuth();
  const [week, setWeek] = useState<GroupWeekSummary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    api.getGroupWeek(groupId, localDate())
      .then(result => { if (active) { setWeek(result); setError(''); } })
      .catch(failure => { if (active) setError(groupErrorMessage(failure, { not_found: 'Este grupo não está mais disponível.' })); });
    return () => { active = false; };
  }, [api, groupId, visible, attempt]);
  const participate = async (value: boolean) => {
    if (saving || !week) return;
    setSaving(true);
    try {
      await api.updateGroupParticipation(groupId, { showInRanking: value });
      setWeek(await api.getGroupWeek(groupId, localDate()));
      showToast(value ? 'Você entrou no placar deste grupo.' : 'Você saiu do placar deste grupo.');
    } catch (failure) { showToast(groupErrorMessage(failure), 'error'); }
    finally { setSaving(false); }
  };
  return <BottomSheet visible={visible} onClose={onClose} title="Semana do grupo" subtitle={week ? `${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}` : undefined} testID="group-week-sheet" backdropLabel="Fechar semana do grupo">
    {!week && !error ? <ActivityIndicator accessibilityLabel="Carregando a semana do grupo" color={c.link} style={s.state}/> : null}
    {error ? <View style={s.error}>
      <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setError(''); setAttempt(value => value + 1); }} style={s.retry}><Text style={s.link}>Tentar novamente</Text></Pressable>
    </View> : null}
    {week && !error ? <>
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statValue}>{week.sharedActivities}</Text><Text style={s.caption}>{week.sharedActivities === 1 ? 'atividade compartilhada' : 'atividades compartilhadas'}</Text></View>
        <View style={s.stat}><Text style={s.statValue}>{week.activePeople}</Text><Text style={s.caption}>{week.activePeople === 1 ? 'pessoa ativa' : 'pessoas ativas'}</Text></View>
      </View>
      <Text accessibilityRole="header" style={s.section}>Placar da semana</Text>
      {!week.ranking.length ? <Text style={s.muted}>Ninguém entrou no placar ainda. Quem participar aparece aqui com a quantidade de treinos da semana.</Text> : null}
      {week.ranking.map((item, index) => <View key={item.user.id} style={[s.row, item.user.id === user?.id && s.rowMine]} accessible accessibilityLabel={`${index + 1}º, ${item.user.displayName}, ${item.workouts} ${item.workouts === 1 ? 'treino' : 'treinos'}`}>
        <Text style={s.position}>{index + 1}</Text>
        <SocialAvatar name={item.user.displayName} url={item.user.avatarUrl} size={36}/>
        <Text numberOfLines={1} style={s.name}>{item.user.displayName}{item.user.id === user?.id ? ' (você)' : ''}</Text>
        <Text style={s.count}>{item.workouts} <Text style={s.caption}>{item.workouts === 1 ? 'treino' : 'treinos'}</Text></Text>
      </View>)}
      <View style={s.optIn}>
        <View style={s.flex}>
          <Text style={s.optInTitle}>Participar do placar</Text>
          <Text style={s.caption}>Mostra aos membros deste grupo quantos treinos você concluiu na semana. Só a contagem; fichas, cargas e horários continuam privados.</Text>
        </View>
        <Switch accessibilityLabel="Participar do placar deste grupo" aria-checked={week.participating} disabled={saving} value={week.participating} onValueChange={value => void participate(value)} trackColor={{ false: c.controlTrackOff, true: c.primary }} thumbColor={c.controlThumb}/>
      </View>
    </> : null}
  </BottomSheet>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  state: { paddingVertical: 24 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: Radius.lg, backgroundColor: c.surfaceSoft, gap: 2 },
  statValue: { ...Type.title, fontWeight: '800', color: c.text },
  caption: { ...Type.caption, color: c.textMuted, fontWeight: '400' },
  muted: { ...Type.label, color: c.textMuted },
  section: { ...Type.bodyLarge, fontWeight: '800', color: c.text, marginTop: 6 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: Radius.md },
  rowMine: { backgroundColor: c.primarySoft },
  position: { ...Type.body, width: 22, textAlign: 'center', fontWeight: '800', color: c.textMuted },
  name: { ...Type.body, flex: 1, minWidth: 0, fontWeight: '700', color: c.text },
  count: { ...Type.body, fontWeight: '800', color: c.text },
  optIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, marginTop: 6 },
  optInTitle: { ...Type.body, fontWeight: '800', color: c.text },
  error: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12, gap: 4 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { ...Type.body, color: c.link, fontWeight: '800' },
});
