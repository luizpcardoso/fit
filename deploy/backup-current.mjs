import { parse } from 'dotenv';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = parse(await readFile(resolve(root, 'apps/api/.env')));
for (const key of ['DB_HOST','DB_USER','DB_PASS','DB_NAME']) if (!config[key]) throw new Error(`Falta ${key} na configuração local.`);
const folder = resolve(homedir(), '.local/share/fit/deployment-backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(folder, { recursive: true, mode: 0o700 });
const media = resolve(config.MEDIA_DIR || resolve(root, 'apps/api/storage/media'));
const dump = spawn('docker', ['exec', '-e', 'MYSQL_PWD', process.env.FIT_DB_CONTAINER || 'mysql', 'mysqldump', '--single-transaction', '--quick', '--hex-blob', '--no-tablespaces', '--set-gtid-purged=OFF', '--column-statistics=0', '-h127.0.0.1', `-u${config.DB_USER}`, config.DB_NAME], { env: { ...process.env, MYSQL_PWD: config.DB_PASS }, stdio: ['ignore','pipe','pipe'] });
let stderr = '';
dump.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk; });
const finished = new Promise((accept,reject) => { dump.on('error',reject); dump.on('close', code => code === 0 ? accept() : reject(new Error(`Falha no backup MySQL: ${stderr}`))); });
const partial = resolve(folder, 'database.sql.gz.partial');
await Promise.all([finished, pipeline(dump.stdout, createGzip(), createWriteStream(partial, { mode: 0o600, flags: 'wx' }))]);
await rename(partial, resolve(folder, 'database.sql.gz'));
await new Promise((accept,reject) => {
  const tar = spawn('tar', ['-C', media, '-czf', resolve(folder, 'media.tar.gz'), '.'], {stdio:['ignore','ignore','pipe']});
  tar.on('error',reject);tar.on('close',code => code === 0 ? accept() : reject(new Error('Não foi possível copiar todas as mídias.')));
});
await writeFile(resolve(folder, 'manifest.json'), JSON.stringify({ createdAt:new Date().toISOString(), sourceDatabase:config.DB_NAME, sourceMedia:media, destinationDatabase:'fit', server:'luizserver@100.86.240.40', apiUrl:'https://luiz.tail508df9.ts.net' },null,2), {mode:0o600,flag:'wx'});
console.log(folder);
