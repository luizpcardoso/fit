import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const palette = {
  primary: '#0891B2',
  secondary: '#67E8F9',
  accent: '#14B8A6',
  lightBackground: '#F2FAFC',
  darkBackground: '#101D27',
  text: '#16404B',
};

type Group = { id: string; name: string; members: number };
const demoGroups: Group[] = [
  { id: 'friends', name: 'Grupo dos Amigos', members: 8 },
  { id: 'work', name: 'Grupo do Trabalho', members: 14 },
  { id: 'coach', name: 'Alunos do Coach X', members: 23 },
];

const plannedDays = ['Seg', 'Qua', 'Sex'];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = {
    background: dark ? palette.darkBackground : palette.lightBackground,
    surface: dark ? '#1C303B' : '#FFFFFF',
    text: dark ? '#EDF9FC' : palette.text,
    muted: dark ? '#AAC1C9' : '#66818B',
    subtle: dark ? '#294550' : '#E4F4F7',
    border: dark ? '#36515B' : '#DAEDF1',
  };

  // Estado de demonstração: substituir por dados da API e do usuário autenticado.
  const [completedWorkouts, setCompletedWorkouts] = useState(1);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [medicationsTaken, setMedicationsTaken] = useState(0);
  const [supplementsTaken, setSupplementsTaken] = useState(1);
  const [activeGroupId, setActiveGroupId] = useState('friends');
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const medicationTotal = 5;
  const supplementTotal = 3;
  const activeGroup = demoGroups.find((group) => group.id === activeGroupId) ?? demoGroups[0];
  const progress = Math.min(completedWorkouts / weeklyGoal, 1);
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Bom dia!' : today.getHours() < 18 ? 'Boa tarde!' : 'Boa noite!';
  const formattedDate = useMemo(
    () => today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const missedPlannedDays = plannedDays.filter((day) => {
    const dayIndex = weekdays.indexOf(day);
    const currentIndex = today.getDay();
    return dayIndex < currentIndex && completedWorkouts < weeklyGoal;
  }).length;
  const remaining = Math.max(weeklyGoal - completedWorkouts, 0);

  const openPlaceholder = (section: string) => {
    // Os módulos ainda não possuem rotas próprias. Não navegar para telas inexistentes.
    // TODO: integrar navegação quando os módulos forem implementados.
    console.info(`Módulo futuro: ${section}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{formattedDate}</Text>
              <Text style={[styles.greeting, { color: colors.text }]}>{greeting}</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Seu progresso começa hoje.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ver notificações" onPress={() => openPlaceholder('Notificações')} style={[styles.notification, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.notificationIcon}>♧</Text>
              {remaining > 0 && <View style={styles.notificationDot} />}
            </Pressable>
          </View>

          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <View style={styles.cardHeading}>
                <View style={[styles.iconTile, { backgroundColor: colors.subtle }]}>
                  <Text style={styles.tileIcon}>⌁</Text>
                </View>
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.muted }]}>SUA META SEMANAL</Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Treinos realizados</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Alterar meta semanal" onPress={() => setWeeklyGoal((goal) => (goal === 3 ? 4 : 3))} style={[styles.settingsButton, { backgroundColor: colors.subtle }]}>
                <Text style={[styles.settingsText, { color: palette.primary }]}>Ajustar</Text>
              </Pressable>
            </View>

            <View style={styles.progressHeader}>
              <Text style={[styles.progressNumber, { color: colors.text }]}>{completedWorkouts}<Text style={[styles.progressDenominator, { color: colors.muted }]}>/{weeklyGoal}</Text></Text>
              <Text style={[styles.progressCaption, { color: colors.muted }]}>{remaining === 0 ? 'Meta concluída! 🎉' : `Faltam ${remaining} treino${remaining === 1 ? '' : 's'}`}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.subtle }]}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: palette.primary }]} />
            </View>

            <View style={styles.weekDays}>
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, index) => {
                const completed = index < completedWorkouts;
                return (
                  <View key={index} style={styles.weekDay}>
                    <View style={[styles.dayCircle, { backgroundColor: completed ? palette.accent : colors.subtle }]}>
                      <Text style={[styles.dayText, { color: completed ? '#FFFFFF' : colors.muted }]}>{completed ? '✓' : day}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {remaining > 0 && missedPlannedDays > 0 ? (
              <View style={[styles.notice, { backgroundColor: dark ? '#3B3526' : '#FFF5DF' }]}>
                <Text style={styles.noticeIcon}>!</Text>
                <Text style={[styles.noticeText, { color: dark ? '#F4DDAA' : '#906318' }]}>
                  {missedPlannedDays} dia(s) planejado(s) já passaram. Você ainda pode compensar nesta semana.
                </Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setCompletedWorkouts((count) => Math.min(count + 1, weeklyGoal))} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>+ Registrar treino de exemplo</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sua rotina de hoje</Text>
            <Text style={[styles.smallText, { color: colors.muted }]}>Doses programadas</Text>
          </View>
          <View style={styles.twoColumns}>
            <DailyCard title="Medicamentos" icon="✚" taken={medicationsTaken} total={medicationTotal} colors={colors} onPress={() => setMedicationsTaken((value) => Math.min(value + 1, medicationTotal))} />
            <DailyCard title="Suplementos" icon="✦" taken={supplementsTaken} total={supplementTotal} colors={colors} onPress={() => setSupplementsTaken((value) => Math.min(value + 1, supplementTotal))} />
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>Toque em um card para simular uma dose registrada.</Text>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sua comunidade</Text>
            <Text style={[styles.smallText, { color: colors.muted }]}>Grupos de treino</Text>
          </View>
          <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Trocar grupo ativo" accessibilityState={{ expanded: groupPickerOpen }} onPress={() => setGroupPickerOpen((open) => !open)} style={styles.rowBetween}>
              <View style={styles.cardHeading}>
                <View style={[styles.iconTile, { backgroundColor: colors.subtle }]}>
                  <Text style={styles.tileIcon}>♙</Text>
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{activeGroup.name}</Text>
                  <Text style={[styles.smallText, { color: colors.muted }]}>{activeGroup.members} participantes</Text>
                </View>
              </View>
              <Text style={[styles.chevron, { color: palette.primary }]}>{groupPickerOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {groupPickerOpen && (
              <View style={[styles.groupOptions, { borderTopColor: colors.border }]}>
                {demoGroups.map((group) => (
                  <Pressable key={group.id} accessibilityRole="button" onPress={() => { setActiveGroupId(group.id); setGroupPickerOpen(false); }} style={[styles.groupOption, { backgroundColor: group.id === activeGroupId ? colors.subtle : 'transparent' }]}>
                    <Text style={[styles.optionText, { color: colors.text }]}>{group.name}</Text>
                    {group.id === activeGroupId && <Text style={{ color: palette.accent }}>✓</Text>}
                  </Pressable>
                ))}
              </View>
            )}
            <View style={[styles.groupFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.groupHint, { color: colors.muted }]}>Feed e atividades exclusivos deste grupo</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/explore')}>
                <Text style={styles.actionLink}>Explorar →</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximos compromissos</Text>
            <Text style={[styles.smallText, { color: colors.muted }]}>Em breve</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openPlaceholder('Agenda')} style={[styles.appointmentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconTile, { backgroundColor: colors.subtle }]}>
              <Text style={styles.tileIcon}>▦</Text>
            </View>
            <View style={styles.appointmentText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Sua agenda em um só lugar</Text>
              <Text style={[styles.smallText, { color: colors.muted }]}>Consultas, reuniões, avaliações e mais.</Text>
            </View>
          </Pressable>
          <Text style={[styles.disclaimer, { color: colors.muted }]}>Prévia interativa com dados fictícios. As alterações são locais e não ficam salvas.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type CardColors = { surface: string; text: string; muted: string; subtle: string; border: string };
function DailyCard({ title, icon, taken, total, colors, onPress }: { title: string; icon: string; taken: number; total: number; colors: CardColors; onPress: () => void }) {
  const complete = total > 0 && taken >= total;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${taken} de ${total} doses. Registrar dose de exemplo`} onPress={onPress} style={[styles.dailyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.dailyIcon, { backgroundColor: colors.subtle }]}>
        <Text style={styles.tileIcon}>{icon}</Text>
      </View>
      <Text style={[styles.dailyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.dailyCount, { color: colors.text }]}>{taken}<Text style={[styles.dailyTotal, { color: colors.muted }]}>/{total}</Text></Text>
      <View style={[styles.miniTrack, { backgroundColor: colors.subtle }]}>
        <View style={[styles.fill, { width: `${total ? (taken / total) * 100 : 0}%`, backgroundColor: palette.accent }]} />
      </View>
      <Text style={[styles.dailyFooter, { color: complete ? palette.accent : colors.muted }]}>{complete ? 'Tudo em dia ✓' : 'Tomadas hoje'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center', gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerCopy: { gap: 4, flexShrink: 1 },
  eyebrow: { fontSize: 12, textTransform: 'capitalize', fontWeight: '500' },
  greeting: { fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 14 },
  notification: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  notificationIcon: { fontSize: 26, color: palette.primary },
  notificationDot: { position: 'absolute', right: 11, top: 10, width: 8, height: 8, backgroundColor: '#E59A3E', borderRadius: 5 },
  heroCard: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  iconTile: { width: 43, height: 43, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  tileIcon: { color: palette.primary, fontSize: 25, fontWeight: '700' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  settingsButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  settingsText: { fontSize: 12, fontWeight: '700' },
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressNumber: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  progressDenominator: { fontSize: 24, fontWeight: '500' },
  progressCaption: { fontSize: 13, fontWeight: '600' },
  track: { height: 10, borderRadius: 10, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 10 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  weekDay: { flex: 1, alignItems: 'center' },
  dayCircle: { width: 33, height: 33, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 12, fontWeight: '700' },
  notice: { padding: 12, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noticeIcon: { color: '#B78221', fontSize: 15, fontWeight: '900' },
  noticeText: { fontSize: 12, lineHeight: 18, flex: 1 },
  primaryButton: { backgroundColor: palette.primary, paddingVertical: 13, borderRadius: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  smallText: { fontSize: 12 },
  twoColumns: { flexDirection: 'row', gap: 12 },
  dailyCard: { flex: 1, borderWidth: 1, borderRadius: 19, padding: 15, gap: 9, minWidth: 0 },
  dailyIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dailyTitle: { fontSize: 14, fontWeight: '700' },
  dailyCount: { fontSize: 29, fontWeight: '800' },
  dailyTotal: { fontSize: 19, fontWeight: '500' },
  miniTrack: { height: 6, borderRadius: 5, overflow: 'hidden' },
  dailyFooter: { fontSize: 11 },
  helper: { fontSize: 11, marginTop: -5 },
  groupCard: { borderWidth: 1, borderRadius: 19, padding: 16, gap: 14 },
  chevron: { fontSize: 25 },
  groupOptions: { borderTopWidth: 1, paddingTop: 9, gap: 4 },
  groupOption: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10 },
  optionText: { fontSize: 14, fontWeight: '600' },
  groupFooter: { borderTopWidth: 1, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  groupHint: { fontSize: 11, flex: 1 },
  actionLink: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  appointmentCard: { borderWidth: 1, borderRadius: 19, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  appointmentText: { flex: 1, gap: 4 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 6 },
});
