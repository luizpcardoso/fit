// Serve the actual portal routes and their security headers; API data is intercepted per browser test.
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { buildApp } from '../../api/src/app.js';
void (async () => {
const app = await buildApp({ jwtSecret: 'portal-browser-test-only-secret-32-characters', portalStore: { access: async () => null, types: async () => [], createType: async () => { throw new Error('unused'); } } });
// Test sources in memory: no app bundle, APK, OTA update or web dist build is generated.
app.addHook('onRequest', async (request, reply) => {
  const match = /^\/portal\/(main|management|library|students|groups|analytics)\.js$/.exec(request.url);
  if (!match) return;
  const source = await readFile(new URL(`../src/${match[1]}.ts`, import.meta.url), 'utf8');
  const result = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
  return reply.header('content-type', 'text/javascript; charset=utf-8').send(result.code);
});
await app.listen({ host: '127.0.0.1', port: 3341 });

})();
