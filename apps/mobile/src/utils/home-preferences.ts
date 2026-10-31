import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Device-local display preferences for Início (like the theme): they change only what is
 * shown on this device and never leave it.
 */
export type HomePreferences = { showEnergyBalance: boolean };
const key = 'fit.home.preferences';
const defaults: HomePreferences = { showEnergyBalance: true };
let current: HomePreferences = defaults;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

async function read(): Promise<HomePreferences> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
    const value = raw ? JSON.parse(raw) as Partial<HomePreferences> : {};
    return { showEnergyBalance: typeof value.showEnergyBalance === 'boolean' ? value.showEnergyBalance : defaults.showEnergyBalance };
  } catch { return defaults; }
}
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  void read().then(value => { current = value; emit(); });
}
export async function setHomePreference<K extends keyof HomePreferences>(name: K, value: HomePreferences[K]) {
  const next = { ...current, [name]: value };
  const raw = JSON.stringify(next);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, raw);
  else await SecureStore.setItemAsync(key, raw);
  current = next;
  emit();
}
export function useHomePreferences() {
  ensureLoaded();
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => current);
}
