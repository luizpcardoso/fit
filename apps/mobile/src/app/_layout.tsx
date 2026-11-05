import { MealSyncProvider } from '@/components/meal-sync-provider';
import { WorkoutRunProvider } from '@/components/workout-run-provider';
import { BodyRemindersProvider } from '@/components/body-reminders-provider';
import { UsageObserver } from '@/components/usage-observer';
import {GroupUpdatesProvider} from '@/components/group-updates-provider';
import {RoutineReminderProvider} from '@/components/routine-reminder-provider';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';
import { addBodyReminderResponseListener, addRoutineNotificationResponseListener, addDailySummaryResponseListener, addMentalNotificationResponseListener, configureMentalNotificationHandling } from '@/utils/notification-bootstrap';
import { useWebKeyboard } from '@/hooks/use-web-keyboard';
import { DialogProvider } from '@/components/app-dialog';
import { DailySummaryProvider } from '@/components/daily-summary-provider';

SplashScreen.preventAutoHideAsync();
configureMentalNotificationHandling();

function Navigation() {
  useWebKeyboard();
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { colors, ready } = useAppTheme();
  useEffect(() => { if (!loading && ready) void SplashScreen.hideAsync(); }, [loading, ready]);
  useEffect(() => { if (loading || !ready || !userId) return; return addBodyReminderResponseListener(kind => router.push({ pathname: '/body-measurements', params: { kind } })); }, [loading, ready, userId]);
  useEffect(()=>{
    if(loading||!ready||!userId)return;
    return addRoutineNotificationResponseListener(()=>router.push({pathname:'/',params:{showChecks:'1'}}));
  },[loading,ready,userId]);
  useEffect(()=>addMentalNotificationResponseListener(()=>router.push('/mental-wellbeing')),[]);
  useEffect(() => {
    if (loading || !ready || !userId) return;
    return addDailySummaryResponseListener(() => router.push({ pathname: '/', params: { showChecks: '1' } }));
  }, [loading, ready, userId]);
  if (loading || !ready) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.link} /></View>;
  return <View style={styles.navigation}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout-create" />
          <Stack.Screen name="workout-run" />
          <Stack.Screen name="workout-detail" />
          <Stack.Screen name="session-edit" />
          <Stack.Screen name="profile-details" />
          <Stack.Screen name="food-tracking" />
          <Stack.Screen name="diet" />
          <Stack.Screen name="body-measurements" />
          <Stack.Screen name="health-routine" />
          <Stack.Screen name="mental-wellbeing" />
          <Stack.Screen name="injectables" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="my-professionals" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="social-groups" />
          <Stack.Screen name="social-settings" />
          <Stack.Screen name="group-detail" />
          <Stack.Screen name="group-post" />
          <Stack.Screen name="group-manage" />
          <Stack.Screen name="group-notifications" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </View>;
}
function ThemedNavigation() {
  const { colors, scheme } = useAppTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // Fundo da janela nativa acompanha o tema: evita faixas/flashes brancos atrás das barras do sistema e nas transições.
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.background); }, [colors.background]);
  const theme = { ...base, colors: { ...base.colors, primary: colors.link, background: colors.background, card: colors.surface, text: colors.text, border: colors.border } };
  return <ThemeProvider value={theme}><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><AuthProvider><WorkoutRunProvider><MealSyncProvider><BodyRemindersProvider><UsageObserver/><DialogProvider><DailySummaryProvider><RoutineReminderProvider><GroupUpdatesProvider><Navigation /></GroupUpdatesProvider></RoutineReminderProvider></DailySummaryProvider></DialogProvider></BodyRemindersProvider></MealSyncProvider></WorkoutRunProvider></AuthProvider></ThemeProvider>;
}
export default function RootLayout() { return <KeyboardProvider statusBarTranslucent navigationBarTranslucent><AppThemeProvider><ThemedNavigation /></AppThemeProvider></KeyboardProvider>; }
const styles = StyleSheet.create({ navigation: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
