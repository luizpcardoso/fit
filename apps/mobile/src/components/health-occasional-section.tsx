import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApiClientError } from '@fit/api-client';
import { randomUUID } from 'expo-crypto';
import type { HealthKind, HealthOccasionalDay, OccasionalIntakeInput } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { formatHealthTimeInput, healthDose, localDay } from '@/utils/health';
import { FormInput } from './form-input';
import { HealthIllustration } from './health-illustration';

// Key this section by kind/date: a late response must never populate a different day's form.
export function HealthOccasionalSection({ kind, date, onlyItemId, onUpdated, allowPast = false, onBusyChange }: {
  kind: HealthKind; date: string; onlyItemId?: string; onUpdated(): Promise<unknown>; allowPast?: boolean; onBusyChange?(busy: boolean): void;
}) {
  const { api } = useAuth(); const { colors: c } = useAppTheme();
  const [data, setData] = useState<HealthOccasionalDay | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [time, setTime] = useState(() => { const now = new Date(); return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; });
  const [message, setMessage] = useState('');
  const writing = useRef(false), live = useRef(true);
  const pending = useRef<{ itemId: string; input: OccasionalIntakeInput } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await api.getHealthOccasionalDay(kind, date);
      if (live.current) setData(result);
      return true;
    } catch { if (live.current) setError('Não foi possível atualizar os eventuais. Tente novamente.'); return false; }
    finally { if (live.current) setLoading(false); }
  }, [api, kind, date]);
  useEffect(() => { live.current = true; const timer = setTimeout(() => { void load(); }, 0); return () => { live.current = false; clearTimeout(timer); }; }, [load]);
  const register = async (itemId: string) => {
    if (writing.current) return;
    if (!allowPast && localDay() !== date) { setError('O dia mudou. Reabra o registro para atualizar a data.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setError('Informe o horário no formato HH:MM.'); return; }
    if (pending.current && pending.current.itemId !== itemId) return;
    pending.current ??= { itemId, input: { operationId: randomUUID(), date, time } };
    writing.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    try {
      await api.createHealthOccasionalIntake(kind, itemId, pending.current.input);
      pending.current = null; setRetrying(null); setMessage('Tomada eventual registrada. A contagem da rotina foi preservada.');
      await load(); await onUpdated();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status >= 400 && cause.status < 500) {
        pending.current = null; setRetrying(null);
        setError('Não foi possível registrar neste cadastro. Atualize os eventuais e tente novamente.');
      } else if (!pending.current) {
        setError('Tomada registrada, mas não foi possível atualizar o resumo. Atualize os eventuais.');
      } else {
        setRetrying(pending.current.itemId);
        setError('Não foi possível confirmar. Tente novamente para conferir a mesma tomada, sem duplicar.');
      }
    }
    finally { writing.current = false; onBusyChange?.(false); if (live.current) setBusy(false); }
  };
  const undo = async (itemId: string, intakeId: string) => {
    if (writing.current || pending.current) return;
    writing.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    try { await api.undoHealthOccasionalIntake(kind, itemId, intakeId); setMessage('Tomada eventual desfeita.'); await load(); await onUpdated(); }
    catch { setError('Não foi possível desfazer. Atualize a lista e tente novamente.'); }
    finally { writing.current = false; onBusyChange?.(false); if (live.current) setBusy(false); }
  };
  const visibleItems = data?.items.filter(item => !onlyItemId || item.id === onlyItemId) ?? [];
  const visibleCount = data?.intakes.filter(intake => !onlyItemId || intake.itemId === onlyItemId).length ?? 0;
  const button = { minHeight: 44, justifyContent: 'center' as const };
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Eventuais{visibleCount ? ` · ${visibleCount} ${visibleCount === 1 ? 'tomada' : 'tomadas'}` : ''}</Text>
    <Text style={{ color: c.textMuted, fontSize: 12 }}>Registros de uso eventual não alteram o progresso da rotina.</Text>
    {loading || busy ? <ActivityIndicator color={c.link}/> : null}
    {error ? <View accessibilityRole="alert"><Text style={{ color: c.danger }}>{error}</Text><Pressable accessibilityRole="button" disabled={busy} style={button} onPress={() => { setError(''); void load(); }}><Text style={{ color: c.link }}>Atualizar eventuais</Text></Pressable></View> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 12 }}>{message}</Text> : null}
    {!loading && data ? <>
      {visibleItems.some(item => item.active && item.usageMode === 'occasional') ? <>
      <Text style={{ color: c.text }}>Horário da tomada (HH:MM)</Text>
      <FormInput accessibilityLabel="Horário da tomada eventual" value={time} editable={!busy && !retrying} keyboardType="number-pad" maxLength={5} onChangeText={value => setTime(formatHealthTimeInput(value))} style={{ padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.text }}/></> : null}
      {!visibleItems.length ? <Text style={{ color: c.textMuted }}>Nenhum eventual cadastrado. Escolha “Eventual” ao cadastrar um medicamento ou suplemento.</Text> : null}
      {visibleItems.map(item => <View key={item.id} style={{ gap: 8, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><HealthIllustration item={item} kind={kind}/><View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800' }}>{item.name}</Text><Text style={{ color: c.textMuted, fontSize: 12 }}>{healthDose(item)} · Eventual</Text></View></View>
        {item.active && item.usageMode === 'occasional' ? <Pressable accessibilityRole="button" accessibilityLabel={`Registrar tomada eventual de ${item.name}`} disabled={busy || (retrying !== null && retrying !== item.id)} style={button} onPress={() => void register(item.id)}><Text style={{ color: c.link, fontWeight: '800' }}>{retrying === item.id ? 'Tentar novamente a mesma tomada' : 'Registrar tomada'}</Text></Pressable> : <Text style={{ color: c.textMuted, fontSize: 12 }}>Histórico · {item.active ? 'atualmente recorrente' : 'cadastro pausado'}</Text>}
        {data.intakes.filter(intake => intake.itemId === item.id).map(intake => <View key={intake.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: c.text }}>{intake.time} · tomada registrada</Text><Pressable accessibilityRole="button" accessibilityLabel={`Desfazer tomada de ${item.name} às ${intake.time}`} disabled={busy || retrying !== null} style={button} onPress={() => void undo(item.id, intake.id)}><Text style={{ color: c.link }}>Desfazer</Text></Pressable></View>)}
      </View>)}
    </> : null}
  </View>;
}
