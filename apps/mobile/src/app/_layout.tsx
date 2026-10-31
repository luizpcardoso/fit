import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';
import { addMentalNotificationResponseListener, configureMentalNotificationHandling } from '@/utils/notification-bootstrap';
import { useWebKeyboard } from '@/hooks/use-web-keyboard';
import { DialogProvider } from '@/components/app-dialog';

SplashScreen.preventAutoHideAsync();
configureMentalNotificationHandling();

function Navigation() {
  useWebKeyboard();
  const { user, loading } = useAuth();
  const { colors, ready } = useAppTheme();
  useEffect(() => { if (!loading && ready) void SplashScreen.hideAsync(); }, [loading, ready]);
  useEffect(()=>addMentalNotificationResponseListener(()=>router.push('/mental-wellbeing')),[]);
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
  const theme = { ...base, colors: { ...base.colors, primary: colors.link, background: colors.background, card: colors.surface, text: colors.text, border: colors.border } };
  return <ThemeProvider value={theme}><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><AuthProvider><DialogProvider><Navigation /></DialogProvider></AuthProvider></ThemeProvider>;
}
export default function RootLayout() { return <KeyboardProvider><AppThemeProvider><ThemedNavigation /></AppThemeProvider></KeyboardProvider>; }
const styles = StyleSheet.create({ navigation: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
