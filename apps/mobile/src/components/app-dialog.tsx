import MaterialCommunityIcons from '@/components/icon';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Scrim, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Cross-platform replacement for Alert.alert. React Native Web implements Alert as a no-op,
 * so confirmations and feedback built on it silently disappear in the browser build.
 */
export type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void | Promise<unknown> };
type DialogRequest = { id: number; title: string; message?: string; buttons: DialogButton[] };
type ToastTone = 'success' | 'error' | 'info';
type ToastRequest = { id: number; message: string; tone: ToastTone };

let dialogHandler: ((request: Omit<DialogRequest, 'id'>) => number) | null = null;
let dismissHandler: ((id: number) => void) | null = null;
let toastHandler: ((message: string, tone: ToastTone) => void) | null = null;

/**
 * Shows a themed dialog. Same argument order as Alert.alert to keep call sites familiar.
 * Returns a function that removes the dialog without running any button.
 */
export function showDialog(title: string, message?: string, buttons: DialogButton[] = [{ text: 'Entendi' }]): () => void {
  if (dialogHandler) { const id = dialogHandler({ title, message, buttons }); return () => dismissHandler?.(id); }
  Alert.alert(title, message, buttons.map(({ text, style, onPress }) => ({ text, style, onPress: onPress ? () => void onPress() : undefined })));
  return () => undefined;
}
/** Asks for confirmation and resolves true only when the confirming action is chosen. */
export function confirmAction(options: { title: string; message?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }) {
  return new Promise<boolean>(resolve => void showDialog(options.title, options.message, [
    { text: options.cancelLabel ?? 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
    { text: options.confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ]));
}
/** Short, non-blocking feedback announced to screen readers. */
export function showToast(message: string, tone: ToastTone = 'success') {
  toastHandler?.(message, tone);
}

export function DialogProvider({ children }: PropsWithChildren) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const nextId = useRef(1);
  useEffect(() => {
    dialogHandler = request => { const id = nextId.current++; setQueue(items => [...items, { ...request, id }]); return id; };
    dismissHandler = id => setQueue(items => items.filter(item => item.id !== id));
    toastHandler = (message, tone) => setToast({ id: nextId.current++, message, tone });
    return () => { dialogHandler = null; dismissHandler = null; toastHandler = null; };
  }, []);
  const close = useCallback((id: number) => setQueue(items => items.filter(item => item.id !== id)), []);
  const current = queue[0];
  return <>
    {children}
    {current ? <DialogView key={current.id} request={current} onClose={() => close(current.id)} /> : null}
    {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(value => value?.id === toast.id ? null : value)} /> : null}
  </>;
}

function DialogView({ request, onClose }: { request: DialogRequest; onClose(): void }) {
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const cancel = request.buttons.find(button => button.style === 'cancel');
  const actions = request.buttons.filter(button => button !== cancel);
  const run = async (button: DialogButton, index: number) => {
    if (busy !== null) return;
    setError('');
    const result = button.onPress?.();
    if (!(result instanceof Promise)) return onClose();
    setBusy(index);
    try { await result; onClose(); }
    catch { setError('Não foi possível concluir. Confira a conexão e tente novamente.'); }
    finally { setBusy(null); }
  };
  const dismiss = () => { if (busy === null && cancel) void run(cancel, -1); else if (busy === null && request.buttons.length === 1) void run(request.buttons[0], 0); };
  return <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
    <View style={s.scrim}>
      <Pressable accessibilityLabel="Fechar" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View accessibilityViewIsModal accessibilityRole={Platform.OS === 'web' ? undefined : 'alert'} style={s.card}>
        <ScrollView bounces={false} contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={s.title}>{request.title}</Text>
          {request.message ? <Text style={s.message}>{request.message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          <View style={s.actions}>
            {actions.map((button, index) => {
              const destructive = button.style === 'destructive';
              const primary = index === actions.length - 1;
              return <Pressable key={button.text} accessibilityRole="button" aria-disabled={busy !== null} aria-busy={busy === index} disabled={busy !== null} onPress={() => void run(button, index)}
                style={({ pressed }) => [s.button, destructive ? s.destructive : primary ? s.primary : s.secondary, pressed && s.pressed]}>
                {busy === index ? <ActivityIndicator color={destructive ? c.danger : primary ? c.onPrimary : c.link} />
                  : <Text style={[s.buttonText, destructive ? s.destructiveText : primary ? s.primaryText : s.secondaryText]}>{button.text}</Text>}
              </Pressable>;
            })}
            {cancel ? <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void run(cancel, -1)} style={({ pressed }) => [s.button, s.cancel, pressed && s.pressed]}>
              <Text style={[s.buttonText, s.secondaryText]}>{cancel.text}</Text>
            </Pressable> : null}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const toastIcons = { success: 'check-circle', error: 'alert-circle', info: 'information' } as const;
function ToastView({ toast, onDone }: { toast: ToastRequest; onDone(): void }) {
  const { colors: c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(onDone), toast.tone === 'error' ? 5000 : 3200);
    return () => clearTimeout(timer);
  }, [opacity, onDone, toast.tone]);
  const tint = toast.tone === 'error' ? c.danger : toast.tone === 'success' ? c.success : c.link;
  return <Animated.View pointerEvents="box-none" style={[toastStyles.wrap, { bottom: insets.bottom + 104, opacity }]}>
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[toastStyles.toast, { backgroundColor: c.surface, borderColor: c.border }]}>
      <MaterialCommunityIcons name={toastIcons[toast.tone]} size={20} color={tint} />
      <Text style={[toastStyles.text, { color: c.text }]}>{toast.message}</Text>
    </View>
  </Animated.View>;
}

const toastStyles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 480, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1, ...Platform.select({ web: { boxShadow: '0 8px 24px rgba(0,0,0,.18)' }, default: { elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } } }) },
  text: { ...Type.body, flexShrink: 1, fontWeight: '600' },
});
const createStyles = (c: AppPalette) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: Scrim, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: c.surface, borderRadius: Radius.xxl, maxWidth: 440, width: '100%', maxHeight: '90%', alignSelf: 'center', overflow: 'hidden' },
  content: { padding: 24, gap: 12 },
  title: { ...Type.title, color: c.text, fontWeight: '800' },
  message: { ...Type.body, color: c.textMuted },
  error: { ...Type.label, color: c.danger, fontWeight: '600' },
  actions: { gap: 8, marginTop: 8 },
  button: { minHeight: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: c.primary },
  secondary: { backgroundColor: c.primarySoft },
  destructive: { backgroundColor: c.dangerSoft },
  cancel: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  buttonText: { ...Type.body, fontWeight: '700' },
  primaryText: { color: c.onPrimary },
  secondaryText: { color: c.link },
  destructiveText: { color: c.danger },
});
