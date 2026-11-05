import {config} from 'dotenv';
import {Sequelize,QueryTypes} from 'sequelize';
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
config({path:resolve(root,'apps/api/.env'),quiet:true});
const db=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASS,{host:process.env.DB_HOST,port:Number(process.env.DB_PORT),dialect:'mysql',logging:false,dialectOptions:process.env.DB_SSL==='true'?{ssl:{rejectUnauthorized:true}}:{}});
try {
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const dir=resolve(root,'artifacts/exercise-image-backups',stamp);
 await mkdir(resolve(dir,'media'),{recursive:true});
 await cp(resolve(root,'design/exercise-images'),resolve(dir,'collection'),{recursive:true});
 const rows=await db.query("SELECT id,name,image_url FROM exercises WHERE source='catalog' ORDER BY id",{type:QueryTypes.SELECT});
 await writeFile(resolve(dir,'catalog-image-links.json'),JSON.stringify(rows,null,2)+'\n');
 const hashes={};
 for(const row of rows.filter(x=>x.image_url)) {
  if(!/^[a-f0-9-]{36}\.webp$/.test(row.image_url))throw Error('Chave de mídia inválida.');
  const source=resolve(process.env.MEDIA_DIR||resolve(root,'apps/api/storage/media'),row.image_url);
  const data=await readFile(source);hashes[row.image_url]=createHash('sha256').update(data).digest('hex');
  await cp(source,resolve(dir,'media',row.image_url));
 }
 await writeFile(resolve(dir,'media-sha256.json'),JSON.stringify(hashes,null,2));
 await writeFile(resolve(dir,'RESTORE.md'),'# Restaurar imagens dos exercícios\n\nBackup específico de imagens; não é backup completo do banco do Orami.\n\n1. Restaurar collection/ em design/exercise-images para recuperar originais, prompts e checklist.\n2. Copiar media/ para MEDIA_DIR do servidor de destino, preservando os nomes; conferir media-sha256.json.\n3. Conferir IDs e nomes de catalog-image-links.json contra o catálogo de destino. Atualizar somente exercises.image_url dos IDs confirmados, em transação e após backup do destino. Não criar exercícios duplicados nem alterar IDs. Valores null representam ausência de imagem na data do backup; não os aplicar para apagar imagens posteriores sem revisão.\n4. Validar as URLs /media/exercises/<chave>. Fichas antigas e históricos não são reescritos.\n\nNenhuma credencial ou dado de usuário está incluído. A consulta reflete o banco configurado em apps/api/.env na execução. Execute sem publicações concorrentes para obter uma cópia consistente.\n');
 execFileSync('tar',['-czf',dir+'.tar.gz','-C',dirname(dir),stamp]);
 console.log(dir+'.tar.gz');
}finally{await db.close()}
