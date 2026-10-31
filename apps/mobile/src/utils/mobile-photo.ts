import * as ImageManipulator from 'expo-image-manipulator';
import type {ImagePickerAsset} from 'expo-image-picker';
// Resize before base64 conversion/upload; never hold the original camera image in JS.
export async function prepareMobilePhoto(asset:ImagePickerAsset,avatar=false){
 const maximum=avatar?512:1600;
 const actions:ImageManipulator.Action[]=[];
 if(Math.max(asset.width,asset.height)>maximum)actions.push({resize:asset.width>=asset.height?{width:maximum}:{height:maximum}});
 const result=await ImageManipulator.manipulateAsync(asset.uri,actions,{compress:.8,format:ImageManipulator.SaveFormat.JPEG,base64:true});
 if(!result.base64)throw new Error('Não foi possível processar a foto.');
 return {base64:result.base64,dataUrl:`data:image/jpeg;base64,${result.base64}`};
}
