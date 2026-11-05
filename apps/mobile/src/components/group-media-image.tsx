import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAuth } from '@/auth/auth-context';

type Source={uri:string;headers?:Record<string,string>;cacheKey?:string};

export function GroupMediaImage({url,kind,style,fallback,contentFit='cover'}:{url:string|null|undefined;kind:'avatar'|'cover';style:StyleProp<ImageStyle>;fallback?:ReactNode;contentFit?:'cover'|'contain'}){
 const {api}=useAuth();
 const [result,setResult]=useState<{url:string;source:Source|null;failed:boolean}>({url:'',source:null,failed:false});
 useEffect(()=>{let active=true;if(!url)return()=>{active=false};api.getGroupMediaSource(url).then(source=>{if(active)setResult({url,source,failed:false})}).catch(()=>{if(active)setResult({url,source:null,failed:true})});return()=>{active=false}},[api,url]);
 const ready=Boolean(url&&result.url===url&&result.source&&!result.failed);
 if(!ready)return <View style={style as StyleProp<ViewStyle>}>{fallback}</View>;
 return <Image testID={`group-${kind}-image`} accessible accessibilityRole="image" source={result.source??undefined} contentFit={contentFit} cachePolicy="memory-disk" recyclingKey={`${kind}-${url}`} onError={()=>setResult({url:url!,source:null,failed:true})} style={[style,styles.image]} accessibilityLabel={kind==='avatar'?'Imagem do grupo':'Foto de capa do grupo'}/>;
}

const styles=StyleSheet.create({image:{overflow:'hidden'}});
