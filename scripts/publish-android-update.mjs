import { createHash, randomUUID, sign, verify, X509Certificate } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, rename, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = resolve(root, 'apps/mobile');
const apiUrl = process.env.FIT_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') throw new Error('Configure FIT_API_URL com a API HTTPS de produção.');
const certificate = new X509Certificate(await readFile(resolve(mobile, 'certs/updates.pem')));
const usage = spawnSync('openssl', ['x509', '-in', resolve(mobile, 'certs/updates.pem'), '-noout', '-ext', 'keyUsage'], { encoding: 'utf8' });
if (usage.status !== 0 || !usage.stdout.includes('Digital Signature') || certificate.ca || !certificate.keyUsage?.includes('1.3.6.1.5.5.7.3.3') || Date.parse(certificate.validTo) <= Date.now()) throw new Error('Certificado OTA sem Digital Signature e Code Signing válidos. OpenSSL é necessário para a validação.');
const env = { ...process.env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: apiUrl };
function run(args, capture = false) {
  return new Promise((accept, reject) => {
    const child = spawn('npx', args, { cwd: mobile, env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = ''; if (capture) child.stdout.on('data', data => { output += data; });
    child.on('error', reject); child.on('exit', code => code === 0 ? accept(output) : reject(new Error(`Expo falhou (${code}).`)));
  });
}
const output = resolve(root, 'artifacts/ota');
const exported = resolve(output, 'export');
const release = resolve(output, 'publish');
await run(['expo', 'export', '--platform', 'android', '--output-dir', exported, '--max-workers', '2']);
const { runtimeVersion } = JSON.parse(await run(['expo-updates', 'runtimeversion:resolve', '--platform', 'android'], true));
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(runtimeVersion)) throw new Error('Runtime inválido.');
const config = JSON.parse(await run(['expo', 'config', '--type', 'public', '--json'], true));
const metadata = JSON.parse(await readFile(resolve(exported, 'metadata.json'), 'utf8')).fileMetadata.android;
const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json', mp3: 'audio/mpeg', js: 'application/javascript', hbc: 'application/javascript' };
await mkdir(resolve(release, 'assets'), { recursive: true });
await mkdir(resolve(release, 'manifests'), { recursive: true });
await mkdir(resolve(release, 'releases'), { recursive: true });
async function asset(path, extension, launch = false) {
  const file = resolve(exported, path);
  if (!file.startsWith(exported + '/')) throw new Error('Caminho de asset inválido.');
  const data = await readFile(file);
  const hash = createHash('sha256').update(data);
  const key = hash.digest('hex');
  const ext = extension?.replace(/^\./, '') || extname(path).slice(1) || 'bin';
  if (!/^[a-z0-9]{1,8}$/.test(ext)) throw new Error('Extensão de asset inválida.');
  const filename = `${key}.${ext}`;
  await copyFile(file, resolve(release, 'assets', filename));
  return { key: launch ? key : basename(path), hash: createHash('sha256').update(data).digest('base64url'), contentType: launch ? 'application/javascript' : types[ext] ?? 'application/octet-stream', ...(launch ? {} : { fileExtension: `.${ext}` }), url: `${apiUrl}/updates/assets/${filename}` };
}
const manifest = JSON.stringify({ id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion,
  launchAsset: await asset(metadata.bundle, undefined, true),
  assets: await Promise.all(metadata.assets.map(item => asset(item.path, item.ext))),
  metadata: { channel: 'production' }, extra: { expoClient: config } });
const keyPath = process.env.FIT_UPDATE_SIGNING_KEY || resolve(homedir(), '.local/share/fit/update-signing/private-key.pem');
if ((await stat(keyPath)).mode & 0o077) throw new Error('A chave de atualização precisa de permissão 600.');
const signature = sign('RSA-SHA256', Buffer.from(manifest), await readFile(keyPath)).toString('base64');
if (!verify('RSA-SHA256', Buffer.from(manifest), await readFile(resolve(mobile, 'certs/updates.pem')), Buffer.from(signature, 'base64'))) throw new Error('A chave privada não corresponde ao certificado do APK.');
const envelope = JSON.stringify({ manifest, signature });
const id = JSON.parse(manifest).id;
await writeFile(resolve(release, 'releases', `${id}.json`), envelope);
const target = resolve(release, 'manifests', `${runtimeVersion}.json`);
await writeFile(`${target}.pending`, envelope);
await rename(`${target}.pending`, target);
await writeFile(resolve(output, 'latest.json'), JSON.stringify({ id, runtimeVersion, manifest: target, publishDirectory: release }, null, 2));
console.log(`Atualização assinada: ${id}\nRuntime: ${runtimeVersion}\nPublicação: ${release}\nEnvie assets primeiro e substitua o manifesto por renomeação atômica.`);

if (process.env.FIT_DEPLOY_HOST) {
  const host = process.env.FIT_DEPLOY_HOST;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9@.:-]+$/.test(host)) throw new Error('Host de publicação inválido.');
  const destination = process.env.FIT_DEPLOY_PATH || '/home/luizserver/apps/fit';
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(destination)) throw new Error('Diretório de publicação inválido.');
  const current = await fetch(`${apiUrl}/downloads/release.json`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
  if (!current.ok || (await current.json()).runtimeVersion !== runtimeVersion) throw new Error('O código nativo mudou ou o APK de referência não está publicado. Gere e publique um novo APK antes desta atualização.');
  const execute = (command, args) => new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? accept() : reject(new Error(`Publicação falhou (${command}, ${code}).`)));
  });
  const remote = `${destination}/deploy/data/updates`;
  await execute('rsync', ['-az', `${release}/assets/`, `${host}:${remote}/assets/`]);
  await execute('rsync', ['-az', `${release}/releases/`, `${host}:${remote}/releases/`]);
  await execute('scp', ['-q', target, `${host}:${remote}/manifests/${runtimeVersion}.json.pending`]);
  await execute('ssh', ['-o', 'BatchMode=yes', host, `mv ${remote}/manifests/${runtimeVersion}.json.pending ${remote}/manifests/${runtimeVersion}.json`]);
  console.log('Atualização assinada publicada. Os aplicativos compatíveis a buscarão na próxima inicialização.');
}
