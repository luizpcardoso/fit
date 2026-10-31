import { renderFormListScroll } from '@/components/form-list-scroll';
import { FormInput as TextInput } from '@/components/form-input';
import { Pagination } from '@/components/pagination';
import { usePagedData } from '@/hooks/use-paged-data';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { showToast } from '@/components/app-dialog';
import { ScreenHeader } from '@/components/screen-header';
import { useAuth } from '@/auth/auth-context';
import { HealthItemForm } from '@/components/health-item-form';
import { HealthTodayModal } from '@/components/health-today-modal';
import { CardShadow, type AppPalette } from '@/constants/theme';
import { localDay, useHealthClock, useHealthRoutine } from '@/hooks/use-health-routine';
import { useAppTheme } from '@/theme/theme-provider';
import { healthDose, isHealthIntakeLate } from '@/utils/health';
import MaterialCommunityIcons from '@/components/icon';
import type { HealthItem, HealthKind } from '@fit/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HealthRoutineScreen() {
  const { kind: requestedKind } = useLocalSearchParams<{ kind?: string }>();
  const kind: HealthKind = requestedKind === 'medication' ? 'medication' : 'supplement';
  return <HealthRoutineView key={kind} kind={kind} />;
}

function HealthRoutineView({ kind }: { kind: HealthKind }) {
  const { colors: c, scheme } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const dimensions = useWindowDimensions();
  const compact = dimensions.height < 650;
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<HealthItem | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [form, setForm] = useState<{ item: HealthItem | null } | null>(null);
  const [register, setRegister] = useState<{ id?: string } | null>(null);
  const now = useHealthClock();
  const date = localDay(now);
  const routine = useHealthRoutine(kind, date);
  const medication = kind === 'medication';
  const title = medication ? 'Medicamentos' : 'Suplementos';
  const singular = medication ? 'medicamento' : 'suplemento';
  const loadPage = useCallback(() => api.getHealthItemsPage(kind, { page, pageSize: 5, search, status: filter }), [api, kind, page, search, filter]);
  const paged = usePagedData(`${kind}:${page}:${search}:${filter}`, loadPage);
  const items = paged.data?.items ?? [];
  const refresh = async () => { await Promise.all([routine.refresh(), paged.refresh()]); };
  const late = routine.daily?.items.filter(entry => isHealthIntakeLate(entry, date, now)).length ?? 0;

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.frame}>
    <FlatList renderScrollComponent={renderFormListScroll}
      ListHeaderComponent={<View style={s.headerContent}>
        <ScreenHeader backLabel="Saúde" onBack={() => router.dismissTo('/health')} />

        <View style={s.header}>
          <View style={s.flex}>
            <Text accessibilityRole="header" style={[s.title, dimensions.width < 370 && { fontSize: 22 }]}>{title}</Text>
            {!compact ? <Text style={s.subtitle}>{medication ? 'Organize horários e registre suas tomadas' : 'Acompanhe doses e mantenha sua rotina em dia'}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Cadastrar ${singular}`} onPress={() => setForm({ item: null })} style={s.addTop}>
            <MaterialCommunityIcons name="plus" size={18} color={c.onPrimary} />
            <Text style={s.addTopText}>Cadastrar</Text>
          </Pressable>
        </View>

        {!compact ? <View style={s.summaryRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Registrar ${title.toLocaleLowerCase('pt-BR')} de hoje`} onPress={() => setRegister({})} style={s.summaryBody}>
            <Text style={s.summaryLabel}>Registros do dia</Text>
            <View style={s.summaryNumbers}>
              <Text style={s.total}>{routine.daily ? `${routine.daily.consumed}/${routine.daily.total}` : '—'}</Text>
              <Text style={s.summaryMuted}>{routine.daily ? routine.daily.remaining ? `${routine.daily.remaining} pendentes` : routine.daily.total ? 'Tudo registrado ✓' : 'Sem programação' : routine.loading ? 'Carregando…' : 'Indisponível'}</Text>
            </View>
            {late ? <Text style={s.late}>{late} {late === 1 ? 'horário pendente' : 'horários pendentes'} já {late === 1 ? 'passou' : 'passaram'}</Text> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir registro diário de ${title.toLocaleLowerCase('pt-BR')}`} onPress={() => setRegister({})} style={s.plus}>
            <MaterialCommunityIcons name="plus" size={23} color={c.onPrimary} />
          </Pressable>
        </View>

        : null}
        {compact ? <Pressable accessibilityRole="button" onPress={() => setRegister({})} style={s.filter}><Text style={s.link}>Registrar tomadas de hoje</Text></Pressable> : null}
        <View style={s.listHeader}>
          <View style={s.flex}>
            <Text style={s.listTitle}>Meus {title.toLocaleLowerCase('pt-BR')}</Text>
            <Text style={s.listSubtitle}>Toque em um cadastro para ver ou editar os detalhes</Text>
          </View>
        </View>
        <TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel={`Buscar ${title.toLocaleLowerCase('pt-BR')}`} value={search} onChangeText={value => { setSearch(value); setPage(1); }} placeholder={medication ? 'Ex.: Losartana' : 'Ex.: Creatina'} style={s.search} clearButtonMode="while-editing" />
        <View style={s.filterRow}>
          {([['all', 'Todos'], ['active', 'Ativos'], ['paused', 'Pausados']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" aria-checked={filter === value} onPress={() => { setFilter(value); setPage(1); }} style={[s.filter, filter === value && s.filterSelected]}><Text style={[s.filterText, filter === value && s.filterTextSelected]}>{label}</Text></Pressable>)}
          <Text style={s.resultCount}>{paged.data?.total ?? 0} {paged.data?.total === 1 ? 'cadastro' : 'cadastros'}</Text>
        </View>
        {paged.error || routine.error ? <View accessibilityRole="alert" style={s.errorBox}><Text style={s.errorText}>{paged.error || routine.error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={s.retry}><Text style={s.link}>Tentar novamente</Text></Pressable></View> : null}
      </View>}
      data={items}
      keyExtractor={item => item.id}
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshing={paged.loading}
      onRefresh={() => void refresh()}

      ListEmptyComponent={paged.loading ? <ActivityIndicator color={c.link} style={s.empty} /> : paged.error ? undefined : <View style={s.empty}>
        <View style={s.emptyIcon}><MaterialCommunityIcons name={medication ? 'pill' : 'shaker-outline'} size={27} color={c.link} /></View>
        <Text style={s.emptyTitle}>{search || filter !== 'all' ? 'Nenhum resultado' : `Seu primeiro ${singular}`}</Text>
        <Text style={s.muted}>{search || filter !== 'all' ? 'Tente outro nome ou filtro.' : 'Cadastre os itens da sua rotina. Depois, use o + para registrar as tomadas.'}</Text>
        {!(search || filter !== 'all') ? <Pressable accessibilityRole="button" style={s.emptyButton} onPress={() => setForm({ item: null })}><Text style={s.addText}>Cadastrar {singular}</Text></Pressable> : null}
      </View>}
      renderItem={({ item }) => {
        const entries = routine.daily?.items.filter(entry => entry.item.id === item.id) ?? [];
        const taken = entries.filter(entry => entry.consumedAt).length;
        return <View style={[s.itemRow, CardShadow]}>
          <View style={[s.itemIcon, !item.active && s.pausedIcon]}><MaterialCommunityIcons name={medication ? 'pill' : 'shaker-outline'} size={20} color={c.link} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.name}`} style={s.itemBody} onPress={() => setForm({ item })}>
            <Text numberOfLines={1} style={s.itemName}>{item.name}</Text>
            <Text numberOfLines={1} style={s.itemDose}>{healthDose(item)}</Text>
            <Text numberOfLines={1} style={s.itemTimes}>{item.times.length ? [...item.times].sort().join(' · ') : `${item.dailyFrequency} tomada(s) ao dia`}</Text>
            <Text style={item.active ? s.itemStatus : s.paused}>{item.active ? `${taken}/${item.dailyFrequency} tomadas hoje` : 'Pausado · toque para editar'}</Text>
          </Pressable>
          <View style={s.itemActions}>
            {item.active ? <Pressable accessibilityRole="button" accessibilityLabel={`Registrar tomada de ${item.name}`} style={s.smallPlus} onPress={() => setRegister({ id: item.id })}><MaterialCommunityIcons name="plus" size={21} color={c.onPrimary} /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.name}`} style={s.retry} onPress={() => setForm({ item })}><Text style={s.editText}>Editar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${item.name}`} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setDeleting(item)}><Text style={{ color: c.danger }}>Excluir</Text></Pressable>
          </View>
        </View>;
      }}
    />
    <Pagination page={paged.data?.page ?? page} totalPages={paged.data?.totalPages ?? 1} loading={paged.loading} onPage={setPage} />
    </View>
    {deleting ? <ConfirmDialog title={`Excluir ${singular}?`} message={`${deleting.name} deixará de aparecer na rotina. As tomadas já registradas serão preservadas. Para interromper temporariamente, use Pausar na edição.`} confirmLabel={`Excluir ${singular}`} onCancel={() => setDeleting(null)} onConfirm={async () => { await api.deleteHealthItem(kind, deleting.id); setDeleting(null); showToast(`${deleting.name} excluído.`); await refresh(); }} /> : null}
    {form ? <HealthItemForm key={`${kind}:${form.item?.id ?? 'new'}`} kind={kind} initial={form.item} onClose={() => setForm(null)} onSave={async (input, active) => {
      if (form.item) await api.updateHealthItem(kind, form.item.id, { ...input, active });
      else await api.createHealthItem(kind, input);
      setForm(null);
      showToast(form.item ? 'Alterações salvas.' : `${medication ? 'Medicamento cadastrado' : 'Suplemento cadastrado'}.`);
      await refresh();
    }} /> : null}
    {register ? <HealthTodayModal key={`${kind}:${date}`} kind={kind} daily={routine.daily} date={date} now={now} loading={routine.loading} error={routine.error} onlyItemId={register.id} onClose={() => setRegister(null)} onUpdated={routine.refresh} /> : null}
  </SafeAreaView>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  frame: { flex: 1, minHeight: 0, paddingHorizontal: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 12 },
  content: { paddingBottom: 12 },
  headerContent: { gap: 10, paddingTop: 10, marginBottom: 10 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -.6, color: c.text },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  addTop: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: c.primary, borderRadius: 16, paddingHorizontal: 12 },
  addTopText: { color: c.onPrimary, fontSize: 12, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, backgroundColor: c.primaryStrong, borderRadius: 20 },
  summaryBody: { flex: 1, gap: 5 },
  summaryLabel: { fontSize: 12, letterSpacing: .5, textTransform: 'uppercase', color: c.heroMuted, fontWeight: '800' },
  summaryNumbers: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  total: { color: c.onPrimary, fontSize: 24, fontWeight: '800' },
  summaryMuted: { color: c.heroMuted, fontSize: 12, lineHeight: 19 },
  late: { color: c.heroWarning, fontSize: 12 },
  plus: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  listTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
  listSubtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  addText: { color: c.onPrimary, fontWeight: '800', fontSize: 12 },
  search: { color: c.text, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20 },
  filterSelected: { backgroundColor: c.primarySoft },
  filterText: { fontSize: 12, color: c.textMuted, fontWeight: '700' },
  filterTextSelected: { color: c.link },
  resultCount: { marginLeft: 'auto', fontSize: 12, color: c.textMuted },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20 },
  itemIcon: { width: 39, height: 39, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pausedIcon: { backgroundColor: c.surfaceSoft },
  itemBody: { flex: 1, gap: 3 },
  itemName: { color: c.text, fontWeight: '800', fontSize: 15 },
  itemDose: { fontSize: 12, color: c.textMuted },
  itemTimes: { fontSize: 12, color: c.textMuted },
  itemStatus: { fontSize: 12, color: c.success },
  paused: { color: c.warning, fontSize: 12 },
  itemActions: { alignItems: 'center', gap: 2 },
  smallPlus: { width: 44, height: 44, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  editText: { color: c.link, fontSize: 12, fontWeight: '700' },
  empty: { paddingVertical: 30, gap: 12 },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  muted: { color: c.textMuted, fontSize: 12, lineHeight: 19 },
  emptyButton: { minHeight: 44, justifyContent: 'center', backgroundColor: c.primary, alignSelf: 'flex-start', paddingHorizontal: 14, borderRadius: 16 },
  errorBox: { backgroundColor: c.dangerSoft, padding: 14, borderRadius: 16, gap: 10 },
  errorText: { color: c.danger, fontSize: 13 },
  link: { color: c.link, fontWeight: '700' },
});
