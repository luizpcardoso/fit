import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { homeShortcutsInputSchema } from '@fit/contracts';
import type { ShortcutRepository } from './shortcut-repository.js';

export async function registerShortcutRoutes(app: FastifyInstance, repo: ShortcutRepository, secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  const base={preHandler:secure,schema:{security:[{bearerAuth:[]}],tags:['Preferências']}};
  app.get('/me/home-shortcuts',{...base,schema:{...base.schema,summary:'Obtém atalhos privados da Home'}},request=>repo.get(request.user.sub));
  app.put('/me/home-shortcuts',{...base,schema:{...base.schema,summary:'Substitui atalhos privados da Home'}},(request)=>repo.save(request.user.sub,homeShortcutsInputSchema.parse(request.body)));
}
