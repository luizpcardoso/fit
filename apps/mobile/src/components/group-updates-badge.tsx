import {useEffect,useState} from 'react';
import {AccessibilityInfo,Animated,StyleSheet,Text,View} from 'react-native';
import {useAppTheme} from '@/theme/theme-provider';
/** Unread counter for header icons. `stale` shows a quiet "!" when the count could not be refreshed and nothing is unread. */
export function GroupUpdatesBadge({count,focused,stale}:{count:number;focused:boolean;stale?:boolean}){
  const {colors:c}=useAppTheme();
  const [reduceMotion,setReduceMotion]=useState(true);
  const [scale]=useState(()=>new Animated.Value(1));
  useEffect(()=>{
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduceMotion(value);}).catch(()=>{});
    const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return()=>{active=false;subscription.remove();};
  },[]);
  useEffect(()=>{
    if(count<=0||focused||reduceMotion)return;
    const pulse=Animated.loop(Animated.sequence([
      Animated.timing(scale,{toValue:1.2,duration:350,useNativeDriver:true}),
      Animated.timing(scale,{toValue:1,duration:350,useNativeDriver:true}),
    ]),{iterations:2});
    pulse.start();return()=>{pulse.stop();scale.setValue(1);};
  },[count,focused,reduceMotion,scale]);
  if(count<=0&&stale)return <View pointerEvents="none" accessible={false} aria-hidden={true} importantForAccessibility="no-hide-descendants" style={s.position}>
    <View style={[s.badge,{backgroundColor:c.warningSoft,borderColor:c.warning}]}><Text accessible={false} style={[s.text,{color:c.warning}]}>!</Text></View>
  </View>;
  if(count<=0)return null;
  return <View pointerEvents="none" accessible={false} aria-hidden={true} importantForAccessibility="no-hide-descendants" style={s.position}>
    <Animated.View style={[s.badge,{backgroundColor:c.danger,borderColor:c.surface,transform:[{scale}]}]}>
      <Text accessible={false} style={[s.text,{color:c.onPrimary}]}>{count>99?'99+':count}</Text>
    </Animated.View>
  </View>;
}
const s=StyleSheet.create({position:{position:'absolute',top:-5,right:-7},badge:{minWidth:22,height:22,borderRadius:11,borderWidth:2,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},text:{fontSize:12,lineHeight:16,fontWeight:'800'}});
