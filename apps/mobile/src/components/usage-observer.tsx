import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/auth/auth-context';
import { analyticsScreenForPath, UsageTracker } from '@/utils/usage-tracker';

export function UsageObserver() {
  const { user, loading, api } = useAuth();
  const userId = user?.id;
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useEffect(() => { currentPath.current = pathname; }, [pathname]);
  const tracker = useRef<UsageTracker | null>(null);
  useEffect(() => {
    // Keep development and automated Expo sessions out of production metrics unless explicitly enabled.
    const enabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
    if (loading || !userId || enabled === 'false' || (__DEV__ && enabled !== 'true')) return;
    const usage = new UsageTracker({ send: (batch, signal) => api.recordAnalytics(batch, signal), uuid: randomUUID,
      platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'other', version: Constants.expoConfig?.version ?? '0.0.0' });
    tracker.current = usage; usage.setScreen(analyticsScreenForPath(currentPath.current));
    const isActive = () => Platform.OS === 'web' ? typeof document !== 'undefined' && document.visibilityState === 'visible' : AppState.currentState === 'active';
    usage.setForeground(isActive());
    const subscription = AppState.addEventListener('change', () => usage.setForeground(isActive()));
    const visibility = () => usage.setForeground(isActive());
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    const interval = setInterval(() => usage.tick(), 15_000);
    return () => { clearInterval(interval); subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility); usage.dispose(); tracker.current = null; };
  }, [api, userId, loading]);
  useEffect(() => { tracker.current?.setScreen(analyticsScreenForPath(pathname)); }, [pathname]);
  return null;
}
