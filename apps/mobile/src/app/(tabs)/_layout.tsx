import { useAppTheme } from '@/theme/theme-provider';
import type { AppPalette } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, BackHandler, Platform, Pressable, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const mainTabPaths = new Set(['/workouts', '/groups', '/nutrition', '/health']);

function TabIcon({ focused, color, active, inactive }: { focused: boolean; color: ColorValue; active: IconName; inactive: IconName }) {
  const { colors: c } = useAppTheme(); const styles = createStyles(c);

  return <View style={[styles.icon, focused && styles.iconSelected]}><MaterialCommunityIcons name={focused ? active : inactive} color={typeof color === 'string' ? color : c.textMuted} size={23} /></View>;
}
// React Navigation 7 reports the focused tab through aria-selected (accessibilityState is not sent).
type NavigationTabButtonProps = Pick<ComponentProps<typeof Pressable>, 'aria-selected' | 'onPress' | 'onLongPress' | 'testID' | 'accessibilityLabel'>;
function ScaledTabPressable({ children, containerStyle, contentStyle, ...props }: NavigationTabButtonProps & { children: ReactNode; containerStyle: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }) {
  const [scale]=useState(()=>new Animated.Value(1));
  const pressIn=()=>Animated.timing(scale,{toValue:.94,duration:85,useNativeDriver:true}).start();
  const pressOut=()=>Animated.spring(scale,{toValue:1,speed:32,bounciness:4,useNativeDriver:true}).start();
  return <Pressable {...props} accessibilityRole="tab" aria-selected={Boolean(props['aria-selected'])} android_ripple={{color:'transparent'}} onPressIn={pressIn} onPressOut={pressOut} style={containerStyle}><Animated.View style={[contentStyle,{transform:[{scale}]}]}>{children}</Animated.View></Pressable>;
}
function TabButton({ 'aria-selected': selected, onPress, onLongPress, testID, accessibilityLabel, children }: NavigationTabButtonProps & { children?: ReactNode }) {
  const { colors: c }=useAppTheme();const styles=createStyles(c);
  return <ScaledTabPressable aria-selected={selected} accessibilityLabel={accessibilityLabel} testID={testID} onPress={onPress} onLongPress={onLongPress} containerStyle={styles.tabTouch} contentStyle={styles.tabTouchContent}>{children}</ScaledTabPressable>;
}
function HomeTabButton({ 'aria-selected': selected, onPress, onLongPress, testID, accessibilityLabel }: NavigationTabButtonProps) {
  const { colors: c } = useAppTheme(); const styles = createStyles(c); const focused = Boolean(selected);
  return <ScaledTabPressable aria-selected={selected} accessibilityLabel={accessibilityLabel ?? 'Início'} testID={testID} onPress={onPress} onLongPress={onLongPress} containerStyle={styles.homeTab} contentStyle={styles.homeTabContent}>
    <View style={[styles.homeOrb, focused && styles.homeOrbFocused]}><MaterialCommunityIcons name="home-variant" size={24} color={c.onPrimary}/></View>{focused ? <View style={styles.homeIndicator}/> : <View style={styles.homeIndicatorPlaceholder}/>} 
  </ScaledTabPressable>;
}

function AndroidTabBackHandler() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!mainTabPaths.has(pathname)) return false;
      router.replace('/');
      return true;
    });

    return () => subscription.remove();
  }, [pathname]);

  return null;
}

export default function TabLayout() {
  const { colors: c } = useAppTheme(); const styles = createStyles(c); const insets = useSafeAreaInsets();
  const safeTabBar = { height: 76 + insets.bottom, paddingBottom: 7 + insets.bottom };

  return <><AndroidTabBackHandler/><Tabs safeAreaInsets={{bottom:0}} screenOptions={{ headerShown: false, tabBarActiveTintColor: c.link, tabBarInactiveTintColor: c.textMuted, tabBarHideOnKeyboard: true, tabBarLabelStyle: styles.label, tabBarItemStyle: styles.item, tabBarStyle: [styles.bar,safeTabBar] }}>
    <Tabs.Screen name="workouts" options={{ title: 'Fitness', tabBarButton: props=><TabButton {...props}/>, tabBarIcon: props => <TabIcon {...props} active="dumbbell" inactive="dumbbell" /> }} />
    <Tabs.Screen name="groups" options={{ title: 'Grupos', tabBarButton: props=><TabButton {...props}/>, tabBarIcon: props => <TabIcon {...props} active="account-group" inactive="account-group-outline" /> }} />
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarLabel: () => null, tabBarButton: props => <HomeTabButton {...props}/>, tabBarIcon: () => null }} />
    <Tabs.Screen name="nutrition" options={{ title: 'Nutrição', tabBarButton: props=><TabButton {...props}/>, tabBarIcon: props => <TabIcon {...props} active="food-apple" inactive="food-apple-outline" /> }} />
    <Tabs.Screen name="health" options={{ title: 'Saúde', tabBarButton: props=><TabButton {...props}/>, tabBarIcon: props => <TabIcon {...props} active="heart-pulse" inactive="heart-pulse" /> }} />
  </Tabs></>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({
  bar: { position: 'absolute', marginHorizontal: 14, borderTopLeftRadius:26,borderTopRightRadius:26,borderTopWidth:0,backgroundColor:c.surface,paddingTop:8,shadowColor:c.text,shadowOpacity:0.14,shadowRadius:18,shadowOffset:{width:0,height:7},elevation:10 },
  item: { borderRadius: 20 }, label: { fontSize: 12, fontWeight: '700', marginTop: 1 }, icon: { width: 40, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, iconSelected: { backgroundColor: c.primarySoft }, tabTouch:{flex:1,alignItems:'center',justifyContent:'center',borderRadius: 20},tabTouchContent:{width:'100%',alignItems:'center',justifyContent:'center'},homeTab:{width:57,alignItems:'center',justifyContent:'flex-start',paddingTop:0},homeTabContent:{alignItems:'center',justifyContent:'flex-start'},homeOrb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderWidth: 3, borderColor: c.surface, shadowColor: c.primaryStrong, shadowOpacity: .2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 5 }, homeOrbFocused: { backgroundColor: c.primaryStrong }, homeIndicator: { width: 18, height: 3, borderRadius: 3, marginTop: 4, backgroundColor: c.secondary }, homeIndicatorPlaceholder: { height: 7 },
});
