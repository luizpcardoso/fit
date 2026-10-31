import { useAppTheme } from '@/theme/theme-provider';
import { Scrim, type AppPalette } from '@/constants/theme';
import type { HealthKind, HealthToday, HealthTodayItem } from '@fit/contracts';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { healthDose, isHealthIntakeLate, localDay } from '@/utils/health';

type Props = { kind: HealthKind; daily: HealthToday | null; date: string; now: Date; loading: boolean; error: string; onlyItemId?: string; onClose(): void; onUpdated(): Promise<boolean>; onManage?(): void };

export function HealthTodayModal({ kind, daily, date, now, loading, error, onlyItemId, onClose, onUpdated, onManage }: Props) {
  const { colors: c } = useAppTheme(); const s = createStyles(c);

  const { api } = useAuth();
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [actionError, setActionError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const medication = kind === 'medication';
  const title = medication ? 'Medicamentos' : 'Suplementos';
  const groups = useMemo(() => {
    const result = new Map<string, HealthTodayItem[]>();
    for (const entry of daily?.items ?? []) {
      if (onlyItemId && entry.item.id !== onlyItemId) continue;
      result.set(entry.item.id, [...(result.get(entry.item.id) ?? []), entry]);
    }
    return [...result.values()].map(items => items.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')));
  }, [daily, onlyItemId]);

  const register = async (entries: HealthTodayItem[], consumed: boolean) => {
    if (busyRef.current || !daily || daily.date !== date) return;
    if (localDay() !== date) { setActionError('O dia mudou. Aguarde a atualização da rotina antes de registrar.'); return; }
    busyRef.current = true;
    setBusy(entries[0].item.id); setActionError(''); setConfirmId(null);
    try {
      for (const entry of entries) await api.setHealthIntake(kind, entry.item.id, date, entry.slot, consumed);
    } catch {
      setActionError('Não foi possível confirmar todas as alterações. Confira as marcações atualizadas e tente novamente.');
    } finally {
      await onUpdated();
      busyRef.current = false; setBusy('');
    }
  };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={s.overlay}><View accessibilityViewIsModal style={s.sheet}>
      <View style={s.header}><View style={s.flex}><Text accessibilityRole="header" style={s.title}>{title} de hoje</Text><Text style={s.muted}>{daily ? `${daily.consumed}/${daily.total} tomadas registradas` : 'Sua rotina diária'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar registro diário" disabled={Boolean(busy)} hitSlop={8} onPress={onClose} style={s.close}><Text style={s.link}>Fechar</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color={c.link} /> : null}
        {error || actionError ? <View accessibilityRole="alert" style={s.errorBox}><Text style={s.errorText}>{actionError || error}</Text><Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => { setActionError(''); void onUpdated(); }} style={s.close}><Text style={s.link}>Tentar novamente</Text></Pressable></View> : null}
        {!loading && !error && !groups.length ? <View style={s.card}><Text style={s.heading}>Nenhuma tomada programada</Text><Text style={s.muted}>Cadastre ou reative um {medication ? 'medicamento' : 'suplemento'} para acompanhar o dia.</Text></View> : null}
        {groups.map(entries => {
          const item = entries[0].item;
          const pending = entries.filter(entry => !entry.consumedAt);
          return <View key={item.id} style={s.card}>
            <View style={s.groupHeader}><View style={s.flex}><Text style={s.heading}>{item.name}</Text><Text style={s.muted}>{healthDose(item)}</Text></View><Text style={s.count}>{entries.length - pending.length}/{entries.length}</Text></View>
            {entries.map(entry => {
              const late = isHealthIntakeLate(entry, date, now);
              return <Pressable key={entry.slot} accessibilityRole="checkbox" accessibilityLabel={`${item.name}, ${entry.time ?? `tomada ${entry.slot + 1}`}`} aria-checked={Boolean(entry.consumedAt)} aria-disabled={Boolean(busy) || Boolean(error)} disabled={Boolean(busy) || Boolean(error)} onPress={() => void register([entry], !entry.consumedAt)} style={[s.slot, entry.consumedAt && s.done, late && s.late]}>
                <View style={[s.check, entry.consumedAt && s.checked]}><Text style={s.checkText}>{entry.consumedAt ? '✓' : ''}</Text></View>
                <View style={s.flex}><Text style={s.slotTitle}>{entry.time ?? `Tomada ${entry.slot + 1}`}</Text><Text style={[s.muted, late && s.lateText]}>{entry.consumedAt ? 'Tomado · toque para desfazer' : late ? 'Horário passou · marcar como tomado' : 'Marcar como tomado'}</Text></View>
              </Pressable>;
            })}
            {busy === item.id ? <ActivityIndicator color={c.link} /> : pending.length ? <>
              {confirmId === item.id ? <View style={s.confirm}><Text style={s.muted}>Registrar todas as {pending.length} tomadas pendentes de {item.name}, incluindo horários futuros? Confirme somente o que já tomou.</Text><Pressable accessibilityRole="button" disabled={Boolean(busy) || Boolean(error)} style={s.primary} onPress={() => void register(pending, true)}><Text style={s.primaryText}>Sim, registrar todas</Text></Pressable><Pressable accessibilityRole="button" style={s.secondary} onPress={() => setConfirmId(null)}><Text style={s.link}>Cancelar</Text></Pressable></View> : <Pressable accessibilityRole="button" disabled={Boolean(busy) || Boolean(error)} style={s.secondary} onPress={() => setConfirmId(item.id)}><Text style={s.link}>Marcar tudo como tomado</Text></Pressable>}
            </> : <Text style={s.complete}>Tudo registrado hoje ✓</Text>}
          </View>;
        })}
        {onManage ? <Pressable accessibilityRole="button" disabled={Boolean(busy)} style={s.secondary} onPress={onManage}><Text style={s.link}>Gerenciar cadastros e horários</Text></Pressable> : null}
      </ScrollView>
    </View></SafeAreaView>
  </Modal>;
}

const createStyles = (c: AppPalette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' }, close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, sheet: { maxHeight: '90%', backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }, content: { padding: 18, paddingBottom: 32, gap: 14 }, flex: { flex: 1 }, title: { fontSize: 21, fontWeight: '800', color: c.text }, heading: { fontSize: 17, fontWeight: '800', color: c.text }, muted: { fontSize: 12, color: c.textMuted, lineHeight: 18 }, link: { color: c.link, fontWeight: '800', textAlign: 'center' }, card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 14, gap: 10 }, groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }, count: { color: c.link, fontWeight: '800', fontSize: 16 }, slot: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: c.background }, done: { backgroundColor: c.primarySoft }, late: { backgroundColor: c.warningSoft }, lateText: { color: c.warning }, check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: c.accent, borderColor: c.accent }, checkText: { color: c.onPrimary, fontWeight: '800' }, slotTitle: { fontSize: 15, fontWeight: '800', color: c.text }, primary: { backgroundColor: c.primary, padding: 14, borderRadius: 12, alignItems: 'center' }, primaryText: { color: c.onPrimary, fontWeight: '800', textAlign: 'center' }, secondary: { padding: 14, backgroundColor: c.surfaceSoft, borderRadius: 12, alignItems: 'center' }, complete: { color: c.success, textAlign: 'center', fontSize: 12, fontWeight: '700' }, confirm: { gap: 10 }, errorBox: { backgroundColor: c.dangerSoft, borderRadius: 12, padding: 14, gap: 10 }, errorText: { color: c.danger, fontSize: 13 },
});
