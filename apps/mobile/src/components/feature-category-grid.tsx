import { CardShadow, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from '@/components/icon';
import { SceneBackdrop, type SceneName } from '@/components/scene';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
/** Com `scene`, a ilustração cobre o cartão e o texto fica branco na base; o ícone vale para cartões sem cena. */
export type FeatureCategory = { key:string;title:string;description:string;icon:IconName;scene?:SceneName;badge?:string;disabled?:boolean;onPress?:()=>void };

export function FeatureCategoryGrid({items}:{items:FeatureCategory[]}){
  const{colors:c}=useAppTheme();const s=styles(c);
  return <View style={s.grid}>{items.map(item=>item.scene?<Pressable key={item.key} accessibilityRole="button" aria-disabled={item.disabled} disabled={item.disabled} onPress={item.onPress} style={({pressed})=>[s.card,s.sceneCard,CardShadow,item.disabled&&s.disabledScene,pressed&&!item.disabled&&s.pressedScene]}>
    <SceneBackdrop scene={item.scene} align="top"/>
    {item.badge?<Text style={[s.badge,s.sceneBadge]}>{item.badge}</Text>:null}
    <View style={s.sceneCopy}>
      <View style={s.sceneTitleRow}><Text style={[s.title,s.sceneTitle]}>{item.title}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={c.heroMuted}/></View>
      <Text style={[s.description,s.sceneDescription]}>{item.description}</Text>
    </View>
  </Pressable>:<Pressable key={item.key} accessibilityRole="button" aria-disabled={item.disabled} disabled={item.disabled} onPress={item.onPress} style={({pressed})=>[s.card,CardShadow,item.disabled&&s.disabled,pressed&&!item.disabled&&s.pressed]}>
    <View style={s.top}><View style={[s.icon,item.disabled&&s.iconDisabled]}><MaterialCommunityIcons name={item.icon} size={25} color={item.disabled?c.textMuted:c.link}/></View>{item.badge?<Text style={[s.badge,item.disabled&&s.badgeDisabled]}>{item.badge}</Text>:<MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted}/>}</View>
    <Text style={s.title}>{item.title}</Text><Text style={s.description}>{item.description}</Text>
  </Pressable>)}</View>;
}

const styles=(c:AppPalette)=>StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:10},card:{width:'48%',flexGrow:1,minWidth:145,minHeight:148,backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:20,padding:15,gap:8},pressed:{transform:[{scale:.985}],backgroundColor:c.surfaceSoft},disabled:{opacity:.72,backgroundColor:c.surfaceSoft},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},icon:{width:46,height:46,borderRadius: 16,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center'},iconDisabled:{backgroundColor:c.surface},badge:{fontSize: 12,fontWeight: '800',color:c.link,backgroundColor:c.primarySoft,paddingHorizontal:8,paddingVertical:5,borderRadius: 12,textTransform:'uppercase'},badgeDisabled:{color:c.textMuted,backgroundColor:c.surface},title:{fontSize:15,fontWeight: '800',color:c.text},description:{fontSize: 12,lineHeight:16,color:c.textMuted},
  // Sobre a ilustração o fundo não muda ao tocar; o retorno vem da escala e da opacidade.
  sceneCard:{overflow:'hidden',backgroundColor:c.primaryStrong,borderWidth:0,justifyContent:'space-between'},pressedScene:{transform:[{scale:.985}],opacity:.88},disabledScene:{opacity:.6},
  sceneBadge:{alignSelf:'flex-start',color:c.onHero,backgroundColor:'transparent',borderWidth:1,borderColor:c.heroMuted},
  sceneCopy:{marginTop:'auto',gap:4},sceneTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},sceneTitle:{flexShrink:1,color:c.onHero},sceneDescription:{color:c.heroMuted}});
