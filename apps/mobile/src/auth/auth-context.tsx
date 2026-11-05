import { hasPendingLocalChanges } from '@/utils/pending-local-changes';
import { confirmAction } from '@/components/app-dialog';
import { ApiClientError, createApiClient } from '@fit/api-client';
import type { LoginInput, PublicUser, RegisterInput, UpdateProfileInput,UpdateSocialProfileInput } from '@fit/contracts';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fit.auth.tokens';
type Tokens = { accessToken: string; refreshToken: string; user?: PublicUser };
const storage = {
  async get(): Promise<Tokens | null> {
    const value = Platform.OS === 'web' ? globalThis.localStorage?.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY);
    if (!value) return null;
    try { return JSON.parse(value) as Tokens; } catch { return null; }
  },
  async set(tokens: Tokens | null) {
    if (Platform.OS === 'web') { if (tokens) globalThis.localStorage?.setItem(TOKEN_KEY, JSON.stringify(tokens)); else globalThis.localStorage?.removeItem(TOKEN_KEY); return; }
    if (tokens) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

type AuthValue = { user: PublicUser | null; loading: boolean; login(input: LoginInput): Promise<void>; register(input: RegisterInput): Promise<void>; updateProfile(input: UpdateProfileInput): Promise<void>;updateSocialProfile(input:UpdateSocialProfileInput):Promise<void>; logout(): Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<PublicUser | null>(null); const [loading, setLoading] = useState(true);
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3333';
  const client = useMemo(() => createApiClient({ baseUrl, getTokens: storage.get, saveTokens: async tokens => {
    await storage.set(tokens);
    if (!tokens) setUser(null);
  } }), [baseUrl]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await storage.get();
      try {
        const profile = await client.me();
        if (!active) return;
        const tokens = await storage.get();
        if (tokens) await storage.set({ ...tokens, user: profile });
        setUser(profile);
      } catch (cause) {
        if (!active) return;
        // Offline recovery uses the account stored beside its credentials. The API still authorizes every sync.
        if (cached?.user && (!(cause instanceof ApiClientError) || cause.status >= 500)) setUser(cached.user);
        else { await storage.set(null); setUser(null); }
      } finally { if (active) setLoading(false); }
    })().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);
  const login = useCallback(async (input: LoginInput) => { const response = await client.login(input); await storage.set(response); setUser(response.user); }, [client]);
  const register = useCallback(async (input: RegisterInput) => { const response = await client.register(input); await storage.set(response); setUser(response.user); }, [client]);
  const updateProfile = useCallback(async (input: UpdateProfileInput) => { setUser(await client.updateProfile(input)); }, [client]);
  const updateSocialProfile=useCallback(async(input:UpdateSocialProfileInput)=>{setUser(await client.updateSocialProfile(input))},[client]);
  const logout = useCallback(async () => {
    const pending = user ? await hasPendingLocalChanges(user.id) : false;
    if (!(await confirmAction(pending ? { title: 'Há registros só neste aparelho', message: 'Sincronize suas refeições e seu treino antes de sair. Se sair agora, os dados locais pendentes serão apagados deste aparelho.', confirmLabel: 'Sair e apagar dados locais', cancelLabel: 'Continuar no app', destructive: true } : { title: 'Sair da conta?', message: 'Você precisará entrar novamente com e-mail e senha neste aparelho.', confirmLabel: 'Sair da conta', cancelLabel: 'Continuar conectado' }))) return;
    try { await client.logout(); } catch { /* Local logout remains available without a connection. */ }
    finally { await storage.set(null); setUser(null); }
  }, [client, user]);
  return <AuthContext.Provider value={{ user, loading, login, register, updateProfile,updateSocialProfile, logout, api: client } as AuthValue & { api: typeof client }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext) as (AuthValue & { api: ReturnType<typeof createApiClient> }) | null; if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider.'); return value; }
