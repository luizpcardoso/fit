import { Pressable, Text, View } from 'react-native';
import { useMealSync } from './meal-sync-provider';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type } from '@/constants/theme';

export function MealSyncStatus() {
  const state = useMealSync(); const { colors: c } = useAppTheme();
  if (!state.entries.length && !state.error) return null;
  const count = state.entries.length, cancellations = state.entries.filter(e => e.request.cancelled).length;
  return <View testID="meal-sync-status" style={{ padding: 14, gap: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: Radius.lg }}>
    <Text accessibilityLiveRegion="polite" style={{ ...Type.body, fontWeight: '700', color: c.text }}>{state.syncing ? 'Enviando refeições…' : count ? cancellations === count ? 'Remoções aguardando envio' : `${count - cancellations} ${count - cancellations === 1 ? 'registro salvo' : 'registros salvos'} neste aparelho` : 'Alimentação disponível neste aparelho'}</Text>
    <Text style={{ ...Type.caption, color: c.textMuted }}>{state.error || 'Os registros já aparecem no seu dia. O app envia em blocos quando houver conexão.'}</Text>
    {state.entries.find(entry => entry.error)?.error ? <Text style={{ ...Type.caption, color: c.danger }}>{state.entries.find(entry => entry.error)!.error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Sincronizar refeições agora" disabled={state.syncing || !state.ready} onPress={() => { void (count ? state.sync() : state.refresh()).catch(() => {}); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...Type.body, color: c.link, fontWeight: '700' }}>{state.syncing ? 'Enviando…' : count ? 'Enviar agora' : 'Atualizar dados'}</Text></Pressable>
  </View>;
}
