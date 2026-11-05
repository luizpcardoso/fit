import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { GroupSummary } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { FormScrollView } from '@/components/form-scroll-view';
import { ScreenHeader } from '@/components/screen-header';
import MaterialCommunityIcons from '@/components/icon';
import { groupErrorMessage } from '@/utils/groups';
import type { AppPalette } from '@/constants/theme';
export default function SocialSettings() {
  const {api}=useAuth(); const {colors:c}=useAppTheme(); const s=styles(c);
  const [groups,setGroups]=useState<GroupSummary[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=useCallback(async()=>{setError('');try{setGroups(await api.listGroups());}catch(failure){setError(groupErrorMessage(failure));}finally{setLoading(false);}},[api]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  return <SafeAreaView style={s.safe}><FormScrollView contentContainerStyle={s.content}>
    <ScreenHeader backLabel="Social"/>
    <Text accessibilityRole="header" style={s.title}>Configurações do Social</Text>
    <Text style={s.description}>Você escolhe o que compartilha e com quem.</Text>
    <View style={s.notice}><MaterialCommunityIcons name="shield-lock-outline" size={24} color={c.link}/><Text style={s.noticeText}>Seu feed é privado. Só aparecem publicações dos seus grupos, feitas após sua entrada mais recente.</Text></View>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/social-groups')} style={s.row}><MaterialCommunityIcons name="account-group-outline" size={24} color={c.link}/><View style={s.flex}><Text style={s.label}>Meus grupos e convites</Text><Text style={s.description}>Criar, participar e gerenciar seus espaços</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted}/></Pressable>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/blocked-users')} style={s.row}><MaterialCommunityIcons name="account-cancel-outline" size={24} color={c.link}/><View style={s.flex}><Text style={s.label}>Pessoas ocultadas</Text><Text style={s.description}>Revise e volte a ver publicações</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted}/></Pressable>
    <Text accessibilityRole="header" style={s.heading}>Compartilhamento por grupo</Text>
    <Text style={s.description}>Atividades automáticas ficam desligadas até você autorizar. As escolhas de um grupo não alteram as dos outros.</Text>
    {loading?<ActivityIndicator accessibilityLabel="Carregando preferências" color={c.link}/>:null}
    {error?<View style={s.notice}><Text accessibilityRole="alert" style={s.description}>{error}</Text><Pressable accessibilityRole="button" onPress={load} style={s.retry}><Text style={s.label}>Tentar novamente</Text></Pressable></View>:null}
    {!loading&&!error&&!groups.length?<Text style={s.description}>Ao entrar em um grupo, suas preferências aparecerão aqui.</Text>:null}
    {groups.map(group=><Pressable key={group.id} accessibilityRole="button" accessibilityLabel={`Preferências de ${group.name}`} onPress={()=>router.push({pathname:'/group-manage',params:{id:group.id,section:'feed'}})} style={s.row}><MaterialCommunityIcons name="tune-variant" size={22} color={c.link}/><View style={s.flex}><Text style={s.label}>{group.name}</Text><Text style={s.description}>{group.active?'Preferências e permissões':'Grupo inativo'}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted}/></Pressable>)}
  </FormScrollView></SafeAreaView>;
}
const styles=(c:AppPalette)=>StyleSheet.create({safe:{flex:1,backgroundColor:c.background},content:{padding:20,paddingBottom:40,gap:16,maxWidth:720,width:'100%',alignSelf:'center'},title:{fontSize:26,fontWeight:'800',color:c.text},heading:{fontSize:18,fontWeight:'800',color:c.text,marginTop:10},description:{fontSize:13,lineHeight:20,color:c.textMuted},notice:{padding:16,gap:10,borderRadius:16,backgroundColor:c.primarySoft},noticeText:{fontSize:14,lineHeight:21,color:c.onPrimarySoft},row:{flexDirection:'row',alignItems:'center',gap:12,padding:16,minHeight:76,backgroundColor:c.surface,borderRadius:16,borderWidth:1,borderColor:c.border},flex:{flex:1,gap:4},label:{fontSize:15,fontWeight:'700',color:c.text},retry:{minHeight:44,justifyContent:'center'}});
