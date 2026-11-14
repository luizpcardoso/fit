import { NavigationDock, type DockIcons } from '@/components/navigation-dock';
import { router, Tabs, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

const mainTabPaths = new Set(['/workouts', '/nutrition', '/health']);
const icons: DockIcons = {
  index: { active: 'home-variant', inactive: 'home-variant-outline' },
  workouts: { active: 'dumbbell', inactive: 'dumbbell' },
  nutrition: { active: 'food-apple', inactive: 'food-apple-outline' },
  health: { active: 'heart-pulse', inactive: 'heart-pulse' },
};

function AndroidTabBackHandler() {
  const pathname = usePathname();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  // Fichas, Histórico and Cardio are sections of the Fitness tab: back returns to its overview first.
  const fitnessSection = pathname === '/workouts' && (section === 'plans' || section === 'training' || section === 'cardio');

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!mainTabPaths.has(pathname)) return false;
      if (fitnessSection) { router.setParams({ section: 'overview' }); return true; }
      router.replace('/');
      return true;
    });

    return () => subscription.remove();
  }, [pathname, fitnessSection]);

  return null;
}

export default function TabLayout() {
  // The dock reserves its own height (and the system navigation inset) in the layout flow.
  return <><AndroidTabBackHandler/><Tabs tabBar={props => <NavigationDock {...props} icons={icons}/>} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" options={{ title: 'Início' }} />
    <Tabs.Screen name="workouts" options={{ title: 'Fitness' }} />
    <Tabs.Screen name="nutrition" options={{ title: 'Nutrição' }} />
    <Tabs.Screen name="health" options={{ title: 'Saúde' }} />
  </Tabs></>;
}
