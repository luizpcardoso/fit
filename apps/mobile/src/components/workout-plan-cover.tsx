import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { WorkoutCoverId } from '@fit/contracts';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from './icon';

const sources: Record<WorkoutCoverId, number> = {
  'running-woman': require('../../assets/images/plan-covers/running-woman.webp'),
  'running-man': require('../../assets/images/plan-covers/running-man.webp'),
  'muscle-woman': require('../../assets/images/plan-covers/muscle-woman.webp'),
  'muscle-man': require('../../assets/images/plan-covers/muscle-man.webp'),
  strength: require('../../assets/images/plan-covers/strength.webp'),
  conditioning: require('../../assets/images/plan-covers/conditioning.webp'),
  mobility: require('../../assets/images/plan-covers/mobility.webp'),
  wellness: require('../../assets/images/plan-covers/wellness.webp'),
};
export function WorkoutPlanCover({ coverId, style }: { coverId?: string|null; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useAppTheme();
  const [failed, setFailed] = useState<string|null>(null);
  const requested = coverId && Object.hasOwn(sources, coverId) ? coverId as WorkoutCoverId : 'wellness';
  const selected = failed === requested ? 'wellness' : requested;
  return <View testID="workout-plan-cover" style={[{ width:'100%',aspectRatio:16/9,maxHeight:240,borderRadius:Radius.lg,overflow:'hidden',backgroundColor:c.surfaceSoft },style]}>
    {failed === 'wellness' ? <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name="run" size={48} color={c.link}/></View> : <Image accessible={false} source={sources[selected]} contentFit="contain" style={{width:'100%',height:'100%'}} onError={() => setFailed(selected)}/>}
  </View>;
}
