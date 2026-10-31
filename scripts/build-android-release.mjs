import { randomBytes, X509Certificate } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, chmod, access, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = resolve(root, 'apps/mobile');
const apiUrl = process.env.FIT_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') throw new Error('Configure FIT_API_URL com o endereço HTTPS definitivo da API.');
const appConfig = JSON.parse(await readFile(resolve(mobile, 'app.json'), 'utf8'));
const signingCertificate = appConfig.expo.updates?.codeSigningCertificate;
if (signingCertificate) {
  const certificate = new X509Certificate(await readFile(resolve(mobile, signingCertificate)));
  const usage = spawnSync('openssl', ['x509', '-in', resolve(mobile, signingCertificate), '-noout', '-ext', 'keyUsage'], { encoding: 'utf8' });
  if (usage.status !== 0 || !usage.stdout.includes('Digital Signature') || certificate.ca || !certificate.keyUsage?.includes('1.3.6.1.5.5.7.3.3') || Date.parse(certificate.validTo) <= Date.now()) throw new Error('O certificado OTA precisa ser válido e declarar Digital Signature e Code Signing. OpenSSL é necessário para a validação.');
}
const signingDir = resolve(homedir(), '.local/share/fit/android-signing');
await mkdir(signingDir, { recursive: true, mode: 0o700 });
await chmod(signingDir, 0o700);
const credentialsPath = resolve(signingDir, 'credentials.json');
let credentials;
try { credentials = JSON.parse(await readFile(credentialsPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  credentials = { keyStore: resolve(signingDir, 'fit-release.keystore'), password: randomBytes(32).toString('hex'), alias: 'fit-release' };
  await writeFile(credentialsPath, JSON.stringify(credentials), { mode: 0o600, flag: 'wx' });
}
const env = { ...process.env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: apiUrl,
  ANDROID_HOME: process.env.ANDROID_HOME || resolve(homedir(), 'Android/Sdk'),
  FIT_ANDROID_KEYSTORE: credentials.keyStore, FIT_ANDROID_STORE_PASSWORD: credentials.password,
  FIT_ANDROID_KEY_PASSWORD: credentials.password, FIT_ANDROID_KEY_ALIAS: credentials.alias };
function run(command, args, cwd = mobile) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept() : reject(new Error(`${command} falhou (${code}).`)));
  });
}
try { await access(credentials.keyStore); }
catch {
  await run('keytool', ['-genkeypair', '-keystore', credentials.keyStore, '-storepass:env', 'FIT_ANDROID_STORE_PASSWORD', '-keypass:env', 'FIT_ANDROID_KEY_PASSWORD', '-alias', credentials.alias, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Fit, O=Fit, C=BR']);
  await chmod(credentials.keyStore, 0o600);
}
await run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
const gradlePath = resolve(mobile, 'android/app/build.gradle');
const signingLine = '\napply from: rootProject.file("../../../deploy/android-signing.gradle")\n';
const gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('deploy/android-signing.gradle')) await writeFile(gradlePath, gradle + signingLine);
// Gradle does not track EXPO_PUBLIC variables as bundle inputs. Always regenerate
// the JS bundle so a release cannot silently reuse another server's address.
await rm(resolve(mobile, 'android/app/build/generated/assets/react/release/index.android.bundle'), { force: true });
await run('./gradlew', [':app:assembleRelease', '--no-daemon', '--max-workers=2', '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m'], resolve(mobile, 'android'));
const outputDir = resolve(root, 'artifacts/android');
await mkdir(outputDir, { recursive: true });
const config = JSON.parse(await readFile(resolve(mobile, 'app.json'), 'utf8'));
const output = resolve(outputDir, `fit-${config.expo.version}.apk`);
await copyFile(resolve(mobile, 'android/app/build/outputs/apk/release/app-release.apk'), output);
console.log(`APK gerado: ${output}`);
console.log(`API: ${apiUrl}`);
console.log(`Guarde uma cópia privada da chave de assinatura e de credentials.json em ${signingDir}.`);
