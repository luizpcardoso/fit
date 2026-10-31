import { CardShadow, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from '@/components/icon';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type FeatureCategory = { key:string;title:string;description:string;icon:IconName;badge?:string;disabled?:boolean;onPress?:()=>void };

export function FeatureCategoryGrid({items}:{items:FeatureCategory[]}){
  const{colors:c}=useAppTheme();const s=styles(c);
  return <View style={s.grid}>{items.map(item=><Pressable key={item.key} accessibilityRole="button" aria-disabled={item.disabled} disabled={item.disabled} onPress={item.onPress} style={({pressed})=>[s.card,CardShadow,item.disabled&&s.disabled,pressed&&!item.disabled&&s.pressed]}>
    <View style={s.top}><View style={[s.icon,item.disabled&&s.iconDisabled]}><MaterialCommunityIcons name={item.icon} size={25} color={item.disabled?c.textMuted:c.link}/></View>{item.badge?<Text style={[s.badge,item.disabled&&s.badgeDisabled]}>{item.badge}</Text>:<MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted}/>}</View>
    <Text style={s.title}>{item.title}</Text><Text style={s.description}>{item.description}</Text>
  </Pressable>)}</View>;
}

const styles=(c:AppPalette)=>StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:10},card:{width:'48%',flexGrow:1,minWidth:145,minHeight:148,backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:20,padding:15,gap:8},pressed:{transform:[{scale:.985}],backgroundColor:c.surfaceSoft},disabled:{opacity:.72,backgroundColor:c.surfaceSoft},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},icon:{width:46,height:46,borderRadius: 16,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center'},iconDisabled:{backgroundColor:c.surface},badge:{fontSize: 12,fontWeight: '800',color:c.link,backgroundColor:c.primarySoft,paddingHorizontal:8,paddingVertical:5,borderRadius: 12,textTransform:'uppercase'},badgeDisabled:{color:c.textMuted,backgroundColor:c.surface},title:{fontSize:15,fontWeight: '800',color:c.text},description:{fontSize: 12,lineHeight:16,color:c.textMuted}});
