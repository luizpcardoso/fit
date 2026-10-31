import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { registerUpdateRoutes } from '../src/update-routes.js';

test('atualização pública é assinada, isolada por runtime e não permite publicação HTTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fit-updates-'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const certificate = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const app = await buildApp({ jwtSecret: 'test-only-secret-at-least-32-characters' });
  registerUpdateRoutes(app, directory, certificate);
  const headers = { 'expo-protocol-version': '1', 'expo-platform': 'android', 'expo-runtime-version': 'test-runtime', 'expo-channel-name': 'production' };
  try {
    await mkdir(join(directory, 'manifests'));
    const manifest = JSON.stringify({ id: '0c7e3a42-74e6-4399-8b95-e4f266ba1f16', runtimeVersion: 'test-runtime', metadata: { channel: 'production' } });
    const signature = sign('RSA-SHA256', Buffer.from(manifest), privateKey).toString('base64');
    await writeFile(join(directory, 'manifests/test-runtime.json'), JSON.stringify({ manifest, signature }));
    const response = await app.inject({ url: '/updates/manifest', headers });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, manifest);
    assert.ok(String(response.headers['expo-signature']).includes(signature));
    assert.equal(response.headers['cache-control'], 'private, no-store');
    const multipart = await app.inject({ url: '/updates/manifest', headers: { ...headers, accept: 'multipart/mixed' } });
    assert.equal(multipart.statusCode, 200); assert.ok(multipart.body.includes(`expo-signature: sig="${signature}"`));
    assert.equal((await app.inject({ url: '/updates/manifest', headers: { ...headers, 'expo-runtime-version': 'different-native-runtime' } })).statusCode, 204);
    assert.equal((await app.inject({ url: '/updates/manifest', headers: { ...headers, 'expo-runtime-version': '../runtime' } })).statusCode, 400);
    assert.equal((await app.inject({ url: '/updates/manifest', headers: { ...headers, 'expo-channel-name': 'preview' } })).statusCode, 204);
    assert.equal((await app.inject({ method: 'POST', url: '/updates/manifest', payload: {} })).statusCode, 404);
    assert.equal((await app.inject({ url: '/updates/manifest', headers: { ...headers, accept: 'text/html' } })).statusCode, 406);
    await writeFile(join(directory, 'manifests/test-runtime.json'), JSON.stringify({ manifest: manifest + ' ', signature }));
    assert.equal((await app.inject({ url: '/updates/manifest', headers })).statusCode, 503);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('API limita conteúdo e mantém cabeçalhos de proteção nas falhas', async () => {
  const app = await buildApp({ jwtSecret: 'test-only-secret-at-least-32-characters' });
  try {
    const large = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a'.repeat(1_100_000), password: 'password' } });
    assert.equal(large.statusCode, 413);
    assert.equal(large.headers['x-content-type-options'], 'nosniff');
    assert.equal(large.headers['x-frame-options'], 'DENY');
    assert.equal(large.body.includes('stack'), false);
    const media = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/xml' }, payload: '<login/>' });
    assert.equal(media.statusCode, 415);
  } finally { await app.close(); }
});

test('identidade do cliente aceita somente proxies internos e ignora IP forjado de acesso direto', async () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = '1';
  const app = await buildApp({ jwtSecret: 'test-only-secret-at-least-32-characters' });
  if (previous === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = previous;
  app.get('/test-client-ip', request => ({ ip: request.ip }));
  try {
    const proxied = await app.inject({ url: '/test-client-ip', remoteAddress: '172.20.0.4', headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.9' } });
    assert.equal(proxied.json().ip, '198.51.100.9');
    const forged = await app.inject({ url: '/test-client-ip', remoteAddress: '198.51.100.10', headers: { 'x-forwarded-for': '1.2.3.4' } });
    assert.equal(forged.json().ip, '198.51.100.10');
  } finally { await app.close(); }
});
