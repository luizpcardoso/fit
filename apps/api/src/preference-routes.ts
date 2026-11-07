import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { updateUserPreferencesSchema } from '@fit/contracts';
import type { PreferenceStore } from './preference-repository.js';

export async function registerPreferenceRoutes(app: FastifyInstance, repo: PreferenceStore, secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  const base = { preHandler: secure, schema: { security: [{ bearerAuth: [] }], tags: ['Preferências'] } };
  app.get('/me/preferences', { ...base, schema: { ...base.schema, summary: 'Obtém preferências privadas da conta' } }, async (request, reply) => { reply.header('cache-control', 'private, no-store'); return repo.get(request.user.sub); });
  app.patch('/me/preferences', { ...base, schema: { ...base.schema, summary: 'Atualiza preferências privadas da conta' } }, request => repo.update(request.user.sub, updateUserPreferencesSchema.parse(request.body)));
}
