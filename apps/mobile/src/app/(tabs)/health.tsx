import { FeatureCategoryGrid } from '@/components/feature-category-grid';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useHealthRoutine } from '@/hooks/use-health-routine';
import { useInjectablesToday } from '@/hooks/use-injectables-today';
import { useAppTheme } from '@/theme/theme-provider';
import { localDate } from '@/utils/dates';
import MaterialCommunityIcons from '@/components/icon';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HealthScreen() {
  const { colors: c } = useAppTheme();
  const s = styles(c);

  return <SafeAreaView style={s.safe} edges={['top']}>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View style={s.flex}>
          <Text accessibilityRole="header" style={s.title}>Saúde</Text>
          <Text style={s.subtitle}>Sua rotina, corpo e bem-estar em um só lugar</Text>
        </View>
        <View style={s.private}><Text style={s.privateText}>Só você</Text></View>
      </View>

      <TodaySummary />

      <View>
        <Text style={s.areaTitle}>Áreas de saúde</Text>
        <Text style={s.areaSubtitle}>Escolha uma área para ver registros, agenda e opções de acompanhamento</Text>
      </View>

      <FeatureCategoryGrid items={[
        { key: 'body', title: 'Corpo e medidas', description: 'Peso, medidas e evolução corporal', icon: 'human-male-height-variant', onPress: () => router.push('/body-measurements') },
        { key: 'medication', title: 'Medicamentos', description: 'Cadastros, horários e tomadas', icon: 'pill', onPress: () => router.push({ pathname: '/health-routine', params: { kind: 'medication' } }) },
        { key: 'supplement', title: 'Suplementos', description: 'Doses e rotina de suplementação', icon: 'shaker-outline', onPress: () => router.push({ pathname: '/health-routine', params: { kind: 'supplement' } }) },
        { key: 'injectable', title: 'Injetáveis', description: 'Agenda, aplicações e meia-vida', icon: 'needle', badge: 'Novo', onPress: () => router.push('/injectables') },
        { key: 'mind', title: 'Mente', description: 'Check-in emocional, diário e apoio', icon: 'head-heart-outline', badge: 'Novo', onPress: () => router.push('/mental-wellbeing') },
      ]} />

    </ScrollView>
  </SafeAreaView>;
}

/** Pending doses for today, reusing the same daily endpoints as Home; hidden when nothing is scheduled. */
function TodaySummary() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const date = localDate();
  const medication = useHealthRoutine('medication', date);
  const supplement = useHealthRoutine('supplement', date);
  const injectables = useInjectablesToday(date);
  const loading = medication.loading || supplement.loading || injectables.loading;
  const failed = Boolean(medication.error || supplement.error || injectables.error);
  const all: { key: string; label: string; done: number; total: number; href: Href }[] = [
    { key: 'medication', label: 'Medicamentos', done: medication.daily?.consumed ?? 0, total: medication.daily?.total ?? 0, href: { pathname: '/health-routine', params: { kind: 'medication' } } },
    { key: 'supplement', label: 'Suplementos', done: supplement.daily?.consumed ?? 0, total: supplement.daily?.total ?? 0, href: { pathname: '/health-routine', params: { kind: 'supplement' } } },
    { key: 'injectable', label: 'Injetáveis', done: injectables.daily?.applied ?? 0, total: injectables.daily?.total ?? 0, href: '/injectables' },
  ];
  const rows = all.filter(row => row.total > 0);
  const retry = () => { void medication.refresh(); void supplement.refresh(); void injectables.refresh(); };
  if (loading && !rows.length) return <View style={s.today}><ActivityIndicator color={c.link} accessibilityLabel="Carregando resumo de hoje" /></View>;
  if (failed && !rows.length) return <View style={s.today}><Text style={s.todayText}>Não foi possível carregar as tomadas de hoje.</Text><Pressable accessibilityRole="button" onPress={retry} style={s.todayRetry}><Text style={s.todayLink}>Tentar novamente</Text></Pressable></View>;
  if (!rows.length) return null;
  const pending = rows.reduce((sum, row) => sum + Math.max(0, row.total - row.done), 0);
  return <View style={s.today}>
    <Text accessibilityRole="header" style={s.todayTitle}>{pending ? `Hoje: ${pending} ${pending === 1 ? 'pendente' : 'pendentes'}` : 'Hoje: tudo registrado'}</Text>
    {rows.map(row => <Pressable key={row.key} accessibilityRole="button" accessibilityLabel={`${row.label}: ${row.done} de ${row.total} registradas hoje. Abrir ${row.label}`} onPress={() => router.push(row.href)} style={({ pressed }) => [s.todayRow, pressed && s.pressed]}>
      <MaterialCommunityIcons name={row.done >= row.total ? 'check-circle' : 'circle-outline'} size={20} color={row.done >= row.total ? c.link : c.textMuted} />
      <Text style={s.todayLabel}>{row.label}</Text>
      <Text style={s.todayCount}>{row.done} de {row.total}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
    </Pressable>)}
    {failed ? <Pressable accessibilityRole="button" onPress={retry} style={s.todayRetry}><Text style={s.todayLink}>Parte do resumo não carregou. Tentar novamente</Text></Pressable> : null}
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingBottom: 115, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -.7, color: c.text },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  private: { backgroundColor: c.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  privateText: { color: c.link, fontSize: 12, fontWeight: '800' },
  areaTitle: { fontSize: 19, fontWeight: '800', color: c.text },
  areaSubtitle: { fontSize: 12, lineHeight: 17, color: c.textMuted, marginTop: 2 },
  today: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, padding: 14, gap: 4 },
  todayTitle: { ...Type.body, color: c.text, fontWeight: '800', marginBottom: 2 },
  todayRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md },
  todayLabel: { ...Type.label, flex: 1, color: c.text, fontWeight: '700' },
  todayCount: { ...Type.label, color: c.textMuted, fontWeight: '700' },
  todayText: { ...Type.label, color: c.textMuted },
  todayRetry: { minHeight: 44, justifyContent: 'center' },
  todayLink: { ...Type.label, color: c.link, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
