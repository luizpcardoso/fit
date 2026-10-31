import MaterialCommunityIcons from '@/components/icon';
import type { GroupReportReason } from '@fit/contracts';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { showToast } from '@/components/app-dialog';
import { FormInput } from '@/components/form-input';
import { FormScrollView } from '@/components/form-scroll-view';
import { Radius, Scrim, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { groupErrorMessage, groupReportReasons } from '@/utils/groups';

export type ReportTarget = { type: 'post' | 'comment'; id: string };
const DETAILS_LIMIT = 500;

/** Folha "Denunciar": motivo obrigatório (enum do contrato) e detalhe opcional limitado a 500 caracteres. */
export function ReportContentSheet(props: { groupId: string; target: ReportTarget | null; onClose(): void; onSent?(): void }) {
  // Mount the form per target so reason, details and errors always start empty.
  return props.target ? <ReportContentForm key={`${props.target.type}:${props.target.id}`} {...props} target={props.target} /> : null;
}
function ReportContentForm({ groupId, target, onClose, onSent }: { groupId: string; target: ReportTarget; onClose(): void; onSent?(): void }) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const [reason, setReason] = useState<GroupReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!sending) onClose(); };
  const send = async () => {
    if (!reason || sending) return;
    setSending(true); setError('');
    try {
      await api.reportGroupContent(groupId, target.type, target.id, reason, details.trim() || undefined);
      onClose();
      onSent?.();
      showToast('Denúncia enviada. Obrigado por avisar.');
    } catch (failure) {
      setError(groupErrorMessage(failure, { conflict: 'Você já denunciou este conteúdo. A moderação do grupo vai analisá-lo.', not_found: 'Este conteúdo foi removido ou não está mais disponível.' }));
    } finally { setSending(false); }
  };
  const subject = target.type === 'comment' ? 'comentário' : 'publicação';
  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <View style={s.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={close} />
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        <FormScrollView keyboardLayout="layout" contentContainerStyle={s.content}>
          <View style={s.header}>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={s.title}>Denunciar {subject}</Text>
              <Text style={s.subtitle}>A moderação do grupo verá o motivo, mas quem publicou não saberá quem denunciou.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar denúncia" disabled={sending} onPress={close} style={s.close}>
              <MaterialCommunityIcons name="close" size={22} color={c.text} />
            </Pressable>
          </View>
          <Text style={s.label}>Qual é o problema?</Text>
          <View accessibilityRole="radiogroup" style={s.options}>
            {groupReportReasons.map(option => {
              const checked = reason === option.key;
              return <Pressable key={option.key} accessibilityRole="radio" aria-checked={checked} aria-disabled={sending} accessibilityHint={option.description} disabled={sending} onPress={() => setReason(option.key)} style={[s.option, checked && s.optionChecked]}>
                <MaterialCommunityIcons name={checked ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={checked ? c.link : c.textMuted} />
                <View style={s.flex}>
                  <Text style={s.optionTitle}>{option.label}</Text>
                  <Text style={s.optionDescription}>{option.description}</Text>
                </View>
              </Pressable>;
            })}
          </View>
          <Text style={s.label}>Detalhes (opcional)</Text>
          <FormInput accessibilityLabel="Detalhes da denúncia" value={details} onChangeText={setDetails} editable={!sending} multiline maxLength={DETAILS_LIMIT} placeholder="Conte o que aconteceu, se quiser." style={s.input} />
          <Text style={s.counter}>{details.length}/{DETAILS_LIMIT}</Text>
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" aria-disabled={!reason || sending} aria-busy={sending} disabled={!reason || sending} onPress={() => void send()} style={[s.primary, (!reason || sending) && s.disabled]}>
            {sending ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryText}>Enviar denúncia</Text>}
          </Pressable>
          {!reason ? <Text style={s.hint}>Escolha um motivo para enviar.</Text> : null}
        </FormScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: c.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, overflow: 'hidden' },
  content: { padding: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  title: { ...Type.title, fontWeight: '800', color: c.text },
  subtitle: { ...Type.label, color: c.textMuted, marginTop: 4 },
  close: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: c.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  label: { ...Type.label, fontWeight: '800', color: c.text, marginTop: 6 },
  options: { gap: 6 },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border },
  optionChecked: { borderColor: c.primary, backgroundColor: c.primarySoft },
  optionTitle: { ...Type.body, fontWeight: '700', color: c.text },
  optionDescription: { ...Type.caption, color: c.textMuted },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 88, textAlignVertical: 'top' },
  counter: { ...Type.caption, color: c.textMuted, alignSelf: 'flex-end' },
  error: { ...Type.label, color: c.danger, fontWeight: '600' },
  primary: { minHeight: 48, borderRadius: Radius.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { ...Type.body, color: c.onPrimary, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  hint: { ...Type.caption, color: c.textMuted, textAlign: 'center' },
});
