import { Scrim, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from '@/components/icon';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Plain-language explanation. Technical material goes in `details`, collapsed under a
 * "Saiba mais"-style disclosure so the main text stays readable. `action` adds a primary
 * next step (e.g. "Ver formas de apoio") that runs after the modal closes.
 */
export function InformationModal({title,paragraphs,details,detailsTitle='Detalhes do cálculo',action,onClose}:{title:string;paragraphs:readonly string[];details?:readonly string[];detailsTitle?:string;action?:{label:string;onPress():void};onClose():void}){
  const{colors:c}=useAppTheme();const s=styles(c);const[expanded,setExpanded]=useState(false);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.overlay}><SafeAreaView style={s.sheet}><View style={s.header}><View style={s.icon}><MaterialCommunityIcons name="information-outline" size={23} color={c.link}/></View><Text accessibilityRole="header" style={s.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar informações" onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={21} color={c.textMuted}/></Pressable></View><ScrollView contentContainerStyle={s.content}>{paragraphs.map((paragraph,index)=><Text key={index} style={s.paragraph}>{paragraph}</Text>)}
    {details?.length?<View style={s.details}><Pressable accessibilityRole="button" aria-expanded={expanded} onPress={()=>setExpanded(value=>!value)} style={s.detailsToggle}><Text style={s.detailsTitle}>{detailsTitle}</Text><MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={20} color={c.link}/></Pressable>{expanded?details.map((paragraph,index)=><Text key={index} style={s.paragraph}>{paragraph}</Text>):null}</View>:null}
    {action?<Pressable accessibilityRole="button" onPress={()=>{onClose();action.onPress()}} style={s.button}><Text style={s.buttonText}>{action.label}</Text></Pressable>:null}
    <Pressable accessibilityRole="button" onPress={onClose} style={action?s.secondary:s.button}><Text style={action?s.secondaryText:s.buttonText}>Entendi</Text></Pressable></ScrollView></SafeAreaView></View></Modal>;
}

const styles=(c:AppPalette)=>StyleSheet.create({overlay:{flex:1,backgroundColor:Scrim,justifyContent:'center',padding:20},sheet:{maxHeight:'82%',maxWidth:560,width:'100%',alignSelf:'center',backgroundColor:c.surface,borderRadius:24,overflow:'hidden'},header:{flexDirection:'row',alignItems:'center',gap:11,padding:18,borderBottomWidth:1,borderBottomColor:c.border},icon:{width:42,height:42,borderRadius: 16,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center'},title:{flex:1,color:c.text,fontSize:20,fontWeight: '800'},close:{width:44,height:44,borderRadius:12,backgroundColor:c.surfaceSoft,alignItems:'center',justifyContent:'center'},content:{padding:19,gap:13},paragraph:{color:c.textMuted,fontSize:13,lineHeight:20},button:{backgroundColor:c.primary,borderRadius: 16,padding:14,alignItems:'center',marginTop:3},buttonText:{color:c.onPrimary,fontWeight: '800'},secondary:{minHeight:44,borderRadius:16,alignItems:'center',justifyContent:'center'},secondaryText:{color:c.link,fontWeight:'800'},details:{borderTopWidth:1,borderTopColor:c.border,paddingTop:4,gap:10},detailsToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},detailsTitle:{color:c.link,fontSize:13,fontWeight:'800'}});
