import * as ImageManipulator from 'expo-image-manipulator';
import type {ImagePickerAsset} from 'expo-image-picker';
// Resize before base64 conversion/upload; never hold the original camera image in JS.
export async function prepareMobilePhoto(asset:ImagePickerAsset,avatar=false){
 const maximum=avatar?512:1600;
 const actions:ImageManipulator.Action[]=[];
 if(Math.max(asset.width,asset.height)>maximum)actions.push({resize:asset.width>=asset.height?{width:maximum}:{height:maximum}});
 const result=await ImageManipulator.manipulateAsync(asset.uri,actions,{compress:.8,format:ImageManipulator.SaveFormat.JPEG,base64:true});
 if(!result.base64)throw new Error('Não foi possível processar a foto.');
 return {base64:result.base64,dataUrl:`data:image/jpeg;base64,${result.base64}`,width:result.width,height:result.height,aspectRatio:result.width/result.height};
}

export async function prepareGroupPhoto(asset:ImagePickerAsset,kind:'avatar'|'cover'){
 const ratio=kind==='avatar'?1:8/3;
 const sourceRatio=asset.width/asset.height;
 const cropWidth=sourceRatio>ratio?Math.round(asset.height*ratio):asset.width;
 const cropHeight=sourceRatio>ratio?asset.height:Math.round(asset.width/ratio);
 const actions:ImageManipulator.Action[]=[{crop:{originX:Math.max(0,Math.round((asset.width-cropWidth)/2)),originY:Math.max(0,Math.round((asset.height-cropHeight)/2)),width:cropWidth,height:cropHeight}},{resize:kind==='avatar'?{width:512,height:512}:{width:1600,height:600}}];
 const result=await ImageManipulator.manipulateAsync(asset.uri,actions,{compress:.84,format:ImageManipulator.SaveFormat.JPEG,base64:true});
 if(!result.base64)throw new Error('Não foi possível processar a imagem do grupo.');
 return {dataUrl:`data:image/jpeg;base64,${result.base64}`,width:result.width,height:result.height,aspectRatio:result.width/result.height};
}

/** A mesma moldura é usada no rascunho e no feed; a foto sempre usa "contain" e nunca é recortada. */
export const groupPostFrameRatio=(ratio:number|null|undefined)=>Math.max(.75,Math.min(1.5,Number.isFinite(ratio)?ratio!:1));
