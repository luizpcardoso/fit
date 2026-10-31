import { useState } from 'react';
import { Pressable } from 'react-native';
import MaterialCommunityIcons from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';
import { InformationModal } from './information-modal';

export function ContextHelp({title,paragraphs}:{title:string;paragraphs:readonly string[]}) {
  const [open,setOpen]=useState(false);
  const {colors}=useAppTheme();
  return <><Pressable accessibilityRole="button" accessibilityLabel={`Informações: ${title}`} onPress={()=>setOpen(true)} style={{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius: 16,backgroundColor:colors.primarySoft}}><MaterialCommunityIcons name="information-outline" size={22} color={colors.link}/></Pressable>{open?<InformationModal title={title} paragraphs={paragraphs} onClose={()=>setOpen(false)}/>:null}</>;
}
