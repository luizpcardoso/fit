import sharp from 'sharp';
export async function processAvatar(value:string){
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
 if(!match)throw new Error('invalid image');
 const input=Buffer.from(match[2],'base64');if(input.length>10*1024*1024)throw new Error('image too large');
 const output=await sharp(input,{limitInputPixels:40_000_000}).rotate().resize(512,512,{fit:'cover',withoutEnlargement:true}).webp({quality:84}).toBuffer();
 return `data:image/webp;base64,${output.toString('base64')}`;
}
