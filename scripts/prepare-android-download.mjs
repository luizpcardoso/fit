import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'apps/mobile/app.json'), 'utf8')).expo;
const apiUrl = process.env.FIT_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') throw new Error('Configure FIT_API_URL com a API HTTPS publicada.');
if (!/^\d+\.\d+\.\d+$/.test(config.version) || !/^\d+\.\d{2}$/.test(config.extra.releaseName)) throw new Error('Versão inválida.');
const filename = `orami-${config.version}-android.apk`, apk = resolve(root, 'artifacts/android', filename);
const toolsRoot = resolve(process.env.ANDROID_HOME || resolve(homedir(), 'Android/Sdk'), 'build-tools');
const tools = resolve(toolsRoot, (await readdir(toolsRoot)).filter(version => /^\d+(\.\d+)+$/.test(version)).sort((a,b) => a.localeCompare(b, undefined, { numeric:true })).at(-1));
function run(command, args) { const result = spawnSync(command, args, { encoding:'utf8' }); if (result.status !== 0) throw new Error(`Falha na verificação: ${command}`); return result.stdout; }
const cert = file => run(resolve(tools, 'apksigner'), ['verify', '--print-certs', file])
  .match(/(?:Signer #1|V\d+ Signer): certificate SHA-256 digest: ([a-f\d]+)/i)?.[1]?.toLowerCase();
const fingerprint = cert(apk);
if (!fingerprint) throw new Error('APK sem certificado verificável.');
if (process.env.FIT_PREVIOUS_APK && cert(resolve(root, process.env.FIT_PREVIOUS_APK)) !== fingerprint) throw new Error('Assinatura diferente do APK anterior; publicação interrompida.');
const badging = run(resolve(tools, 'aapt2'), ['dump','badging',apk]);
if (!badging.includes(`name='${config.android.package}'`) || !badging.includes(`versionCode='${config.android.versionCode}'`) || !badging.includes(`versionName='${config.version}'`)) throw new Error('Versão/package do binário não corresponde à configuração.');
const runtimeVersion = run('unzip', ['-p', apk, 'assets/fingerprint']).trim();
if (!/^[a-f0-9]{40,64}$/.test(runtimeVersion)) throw new Error('Runtime fingerprint ausente ou inválido.');
const bytes = await readFile(apk), sha256 = createHash('sha256').update(bytes).digest('hex');
const release = { version:config.version, displayVersion:config.extra.releaseName, versionCode:config.android.versionCode, runtimeVersion, sha256, bytes:bytes.length, fileName:filename, downloadUrl:new URL(`/downloads/${filename}`,apiUrl).href };
await writeFile(resolve(root,'artifacts/android/release.json'),JSON.stringify(release,null,2)+'\n');
await writeFile(`${apk}.sha256`,`${sha256}  ${filename}\n`);
console.log(JSON.stringify({ ...release, signingCertificateSha256:fingerprint },null,2));
