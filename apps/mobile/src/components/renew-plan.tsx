import { useAppTheme } from '@/theme/theme-provider';
import { Scrim, type AppPalette } from '@/constants/theme';
import type { WorkoutPlan } from '@fit/contracts';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { ValidityPicker } from './validity-picker';
import MaterialCommunityIcons from '@/components/icon';

export function RenewPlan({ plan, onRenewed, variant = 'button' }: { plan: WorkoutPlan; onRenewed: (plan: WorkoutPlan) => void; variant?: 'button' | 'tile' }) {
  const { colors: c } = useAppTheme(); const s = createStyles(c);

  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = Number(days);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= 365;
  const renew = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { const updated = await api.renewWorkoutPlan(plan.id, amount); onRenewed(updated); setOpen(false); }
    catch { setError('Não foi possível revalidar a ficha. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Revalidar ficha ${plan.name}`} onPress={() => { setDays('30'); setError(''); setOpen(true); }} style={variant==='tile'?s.tile:s.secondary}>{variant==='tile'?<><View style={s.tileIcon}><MaterialCommunityIcons name="calendar-refresh-outline" size={21} color={c.link}/></View><Text style={s.tileTitle}>Revalidar ficha</Text><Text style={s.tileText}>Definir novo prazo</Text></>:<Text style={s.link}>Revalidar ficha</Text>}</Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <SafeAreaView style={s.overlay}><View accessibilityViewIsModal style={s.card}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>Revalidar ficha</Text>
        <Text style={s.text}>{plan.name}</Text><Text style={s.text}>O novo prazo começa hoje e substitui o vencimento anterior. Seus exercícios e histórico continuam na mesma ficha.</Text>
        <ValidityPicker days={days} onChange={setDays} disabled={busy} />
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={!valid || busy} onPress={renew} style={[s.button, (!valid || busy) && s.disabled]}>{busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.buttonText}>Revalidar por {valid ? amount : '…'} dias</Text>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancelar revalidação" disabled={busy} onPress={() => setOpen(false)} style={s.secondary}><Text style={s.link}>Cancelar</Text></Pressable>
      </ScrollView></View></SafeAreaView>
    </Modal>
  </>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({ overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'center', alignItems: 'center', padding: 24 }, card: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 20, backgroundColor: c.surface, overflow: 'hidden' }, content: { padding: 20, gap: 16 }, title: { color: c.text, fontSize: 22, fontWeight: '800' }, text: { color: c.textMuted, lineHeight: 21 }, button: { backgroundColor: c.primary, padding: 16, borderRadius: 12, alignItems: 'center' }, buttonText: { color: c.onPrimary, fontWeight: '800', textAlign: 'center' }, secondary: { backgroundColor: c.surfaceSoft, padding: 15, borderRadius: 12, alignItems: 'center' }, link: { color: c.link, fontWeight: '800' }, error: { color: c.danger }, disabled: { opacity: 0.5 },tile:{width:'48%',flexGrow:1,minWidth:140,minHeight:105,borderWidth:1,borderColor:c.border,borderRadius:16,backgroundColor:c.surface,padding:12,justifyContent:'center'},tileIcon:{width:36,height:36,borderRadius:12,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center',marginBottom:7},tileTitle:{fontSize:12,fontWeight: '800',color:c.text},tileText:{fontSize: 12,color:c.textMuted,marginTop:2} });
