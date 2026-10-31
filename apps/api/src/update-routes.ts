import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verify } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/** Public, signed application code only. Publishing requires filesystem/SSH access. */
export function registerUpdateRoutes(app: FastifyInstance, directory: string, certificate: string) {
  app.get('/updates/manifest', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    reply.headers({ 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'expo-manifest-filters': '', 'expo-server-defined-headers': '', 'cache-control': 'private, no-store', vary: 'expo-runtime-version, expo-platform, expo-channel-name, accept' });
    const runtime = request.headers['expo-runtime-version'];
    if (request.headers['expo-protocol-version'] !== '1' || request.headers['expo-platform'] !== 'android' || typeof runtime !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(runtime)) {
      return reply.code(400).send({ code: 'INVALID_INPUT', message: 'Configuração de atualização inválida.' });
    }
    if (request.headers['expo-channel-name'] !== 'production') return reply.code(204).send();
    let envelope: { manifest: string; signature: string };
    try { envelope = JSON.parse(await readFile(resolve(directory, 'manifests', `${runtime}.json`), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reply.code(204).send();
      throw error;
    }
    // Fail closed if a publication is incomplete or has been modified on disk.
    if (typeof envelope.manifest !== 'string' || typeof envelope.signature !== 'string' || !verify('RSA-SHA256', Buffer.from(envelope.manifest), certificate, Buffer.from(envelope.signature, 'base64'))) {
      return reply.code(503).send({ code: 'UNAVAILABLE', message: 'Atualização temporariamente indisponível.' });
    }
    const manifest = JSON.parse(envelope.manifest);
    if (manifest.runtimeVersion !== runtime || manifest.metadata?.channel !== 'production') return reply.code(503).send({ code: 'UNAVAILABLE', message: 'Atualização temporariamente indisponível.' });
    const accept = request.headers.accept ?? 'application/expo+json';
    const signature = `sig="${envelope.signature}", keyid="main", alg="rsa-v1_5-sha256"`;
    if (!/application\/(expo\+json|json)|\*\/\*/i.test(accept)) {
      if (!accept.includes('multipart/mixed')) return reply.code(406).send();
      const boundary = 'fit-update-manifest';
      return reply.type(`multipart/mixed; boundary=${boundary}`).send(`--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\nContent-Type: application/json\r\nexpo-signature: ${signature}\r\n\r\n${envelope.manifest}\r\n--${boundary}--\r\n`);
    }
    return reply.header('expo-signature', signature).type('application/expo+json').send(envelope.manifest);
  });
}
