import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AppColors, DarkColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'system' | 'light' | 'dark';
const key = 'fit.appearance.theme';
const valid = (value: unknown): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';
const ThemeContext = createContext<{
  preference: ThemePreference; scheme: 'light' | 'dark'; colors: typeof DarkColors;
  ready: boolean; saving: boolean; error: string; setPreference(value: ThemePreference): Promise<void>;
} | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setValue] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const value = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
        if (alive && valid(value)) setValue(value);
      } catch { if (alive) setError('Não foi possível carregar sua preferência de aparência.'); }
      finally { if (alive) setReady(true); }
    })();
    return () => { alive = false; };
  }, []);
  const scheme = preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
  const setPreference = async (value: ThemePreference) => {
    if (!valid(value) || busy.current || !ready) return;
    busy.current = true; setSaving(true); setError('');
    try {
      if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
      setValue(value);
    } catch { setError('Não foi possível salvar o tema. Tente novamente.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <ThemeContext.Provider value={{ preference, scheme, colors: scheme === 'dark' ? DarkColors : AppColors, ready, saving, error, setPreference }}>{children}</ThemeContext.Provider>;
}
export function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('Tema indisponível fora de AppThemeProvider.');
  return theme;
}
