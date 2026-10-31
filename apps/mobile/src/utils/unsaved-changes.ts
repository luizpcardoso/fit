import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { confirmAction } from '@/components/app-dialog';

/** Screens register pending work while it exists; navigation helpers ask before discarding it. */
const guards = new Map<symbol, string>();

export function useUnsavedChanges(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const key = Symbol('unsaved');
    guards.set(key, message);
    // The Android system back button bypasses ScreenHeader, so it needs the same question.
    const subscription = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {
      void confirmLeave().then(leave => { if (leave) { guards.delete(key); router.back(); } });
      return true;
    }) : null;
    return () => { guards.delete(key); subscription?.remove(); };
  }, [active, message]);
}

export async function confirmLeave() {
  const message = [...guards.values()].at(-1);
  if (!message) return true;
  return confirmAction({ title: 'Sair sem salvar?', message, confirmLabel: 'Sair sem salvar', cancelLabel: 'Continuar aqui', destructive: true });
}
