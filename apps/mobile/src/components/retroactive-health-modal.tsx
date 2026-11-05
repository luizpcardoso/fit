import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput } from './form-input';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { dateInputToIso, formatDateInput, isoDateToInput } from '@/utils/date-input';
import { localDate, shiftDate } from '@/utils/dates';
import type { HealthKind } from '@fit/contracts';
type Row = { id: string; slot: number; name: string; time: string | null; done: boolean };
export function RetroactiveHealthModal({ kind, onClose, onUpdated }: { kind: HealthKind | 'injectable'; onClose(): void; onUpdated(): Promise<unknown> }) {
  const { api } = useAuth(); const { colors: c } = useAppTheme();
  const initialDate = shiftDate(localDate(), -1);
  const [input, setInput] = useState(isoDateToInput(initialDate));
  const [date, setDate] = useState(initialDate), [rows, setRows] = useState<Row[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const live = useRef(true), version = useRef(0), writing = useRef(false);
  useEffect(() => { live.current = true; version.current++; return () => { live.current = false; }; }, []);
  const load = useCallback(async (target: string) => {
    const revision = ++version.current;
    setLoading(true); setError(''); setRows([]); setDate(target);
    try {
      let result: Row[];
      if (kind === 'injectable') {
        const daily = await api.getInjectablesToday(target);
        result = daily.items.map(entry => ({ id: entry.injectable.id, slot: 0, name: entry.injectable.name, time: null, done: Boolean(entry.application) }));
      } else {
        const daily = await api.getHealthToday(kind, target);
        result = daily.items.map(entry => ({ id: entry.item.id, slot: entry.slot, name: entry.item.name, time: entry.time, done: Boolean(entry.consumedAt) }));
      }
      if (live.current && version.current === revision) setRows(result);
    } catch { if (live.current && version.current === revision) setError('Não foi possível consultar esta data. Tente novamente.'); }
    finally { if (live.current && version.current === revision) setLoading(false); }
  }, [api, kind]);
  useEffect(() => { const timer = setTimeout(() => { void load(initialDate); }, 0); return () => clearTimeout(timer); }, [load, initialDate]);
  const consult = () => {
    const selected = dateInputToIso(input);
    if (!selected || selected >= localDate()) { setError('Escolha uma data válida anterior a hoje.'); return; }
    setMessage(''); void load(selected);
  };
  const register = async (row: Row) => {
    if (writing.current || row.done || loading || input !== isoDateToInput(date)) return;
    writing.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'injectable') await api.setInjectableApplication(row.id, date, true);
      else await api.setHealthIntake(kind, row.id, date, row.slot, true);
      if (!live.current) return;
      setMessage('Check registrado na data escolhida. Os demais registros foram preservados.');
      await load(date); await onUpdated().catch(() => {});
    } catch { if (live.current) setError('Não foi possível registrar. Atualize a consulta e tente novamente.'); }
    finally { writing.current = false; if (live.current) setBusy(false); }
  };
  const changed = input !== isoDateToInput(date);
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}><SafeAreaView style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}><View style={{ maxHeight: '90%', backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Registrar em data anterior</Text>
    <Text style={{ color: c.textMuted }}>Para uma tomada ou aplicação que aconteceu, mas você esqueceu de marcar. Isto não orienta tomar ou aplicar doses esquecidas.</Text>
    <Text style={{ color: c.textMuted }}>A lista usa os cadastros ativos e a programação atuais. Se houve mudança de dose ou rotina, não use este registro para representar uma programação antiga diferente.</Text>
    <Text style={{ color: c.text }}>Data do registro (DD/MM/AAAA)</Text>
    <FormInput accessibilityLabel="Data do check anterior" value={input} editable={!busy} onChangeText={value => { setInput(formatDateInput(value)); setError(''); setMessage(''); }} keyboardType="number-pad" maxLength={10} style={{ color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}/>
    <Pressable accessibilityRole="button" disabled={busy || loading} onPress={consult} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '800' }}>Consultar data</Text></Pressable>
    {changed ? <Text style={{ color: c.textMuted }}>Consulte a nova data antes de registrar.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text> : null}
    {message ? <Text accessibilityRole="text" style={{ color: c.success }}>{message}</Text> : null}
    {loading || busy ? <ActivityIndicator color={c.link}/> : null}
    {!loading && !error && !changed && !rows.length ? <Text style={{ color: c.textMuted }}>Nenhum registro previsto nesta data pela programação atual.</Text> : null}
    {!changed && rows.map(row => <View key={`${row.id}:${row.slot}`} style={{ padding: 14, gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.surface }}><Text style={{ color: c.text, fontWeight: '700' }}>{row.name}</Text><Text style={{ color: c.textMuted }}>{row.time ?? (kind === 'injectable' ? 'Aplicação prevista' : `Tomada ${row.slot + 1}`)} · {isoDateToInput(date)}</Text><Pressable accessibilityRole="button" disabled={busy || loading || row.done || Boolean(error)} onPress={() => void register(row)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: row.done ? c.textMuted : c.link }}>{row.done ? 'Já registrado ✓' : 'Confirmar que realizei nesta data'}</Text></Pressable></View>)}
    <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, textAlign: 'center', fontWeight: '800' }}>Concluir</Text></Pressable>
  </ScrollView></View></SafeAreaView></Modal>;
}
