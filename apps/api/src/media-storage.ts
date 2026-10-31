import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(process.env.MEDIA_DIR||fileURLToPath(new URL('../storage/media',import.meta.url)));
export async function saveMedia(data:Buffer){await mkdir(root,{recursive:true});const key=`${randomUUID()}.webp`;await writeFile(join(root,key),data,{flag:'wx'});return key;}
function path(key:string){if(!/^[a-f0-9-]{36}\.webp$/.test(key))throw new Error('Invalid media key');return join(root,key);}
export const readMedia=(key:string)=>readFile(path(key));
export async function removeMedia(key:string){try{await unlink(path(key))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
