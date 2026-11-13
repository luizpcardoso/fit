import type { ComponentProps, ReactNode } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@/components/icon';
import { Radius, Type } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

const artwork = {
  workout: require('../../assets/images/scenes/home-workout.webp'),
  food: require('../../assets/images/scenes/home-food.webp'),
  balance: require('../../assets/images/scenes/home-balance.webp'),
};

/** One surface and header for the three daily panels. Art never affects measurement or contrast. */
export function HomeAccompanimentCard({ topic, title, icon, action, children, testID }: {
  topic: keyof typeof artwork;
  title: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  action?: ReactNode;
  children: ReactNode;
  testID: string;
}) {
  const { colors: c } = useAppTheme();
  return <View testID={testID} style={{ flexGrow: 1, minHeight: 300, padding: 18, gap: 12, borderRadius: Radius.xxl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', top: 52, right: -24, width: 184, height: 184, opacity: .09 }}>
      <Image source={artwork[topic]} tintColor={c.link} contentFit="contain" transition={0} accessible={false} style={{ width: '100%', height: '100%' }}/>
    </View>
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: Radius.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={21} color={c.link}/>
      </View>
      <Text accessibilityRole="header" style={{ ...Type.title, color: c.text, fontWeight: '800', flex: 1 }}>{title}</Text>
      {action}
    </View>
    {children}
  </View>;
}
