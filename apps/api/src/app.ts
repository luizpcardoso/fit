import { createHash, randomBytes } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import { z, ZodError } from 'zod';
import { authJsonSchema, errorJsonSchema, loginInputSchema, refreshInputSchema, registerInputSchema, socialUsernameSchema, updateProfileSchema, updateSocialProfileSchema, userJsonSchema, type PublicUser } from '@fit/contracts';
import { MemoryAuthRepository, type AuthRepository } from './repository.js';
import type { WorkoutRepository } from './workout-repository.js';
import { registerWorkoutRoutes } from './workout-routes.js';
import type { SupplementRepository } from './supplement-repository.js';
import { registerSupplementRoutes } from './supplement-routes.js';
import type { NutritionRepository } from './nutrition-repository.js';
import { registerNutritionRoutes } from './nutrition-routes.js';
import type { CardioRepository } from './cardio-repository.js';
import { registerCardioRoutes } from './cardio-routes.js';
import type { ShortcutRepository } from './shortcut-repository.js';
import { registerShortcutRoutes } from './shortcut-routes.js';
import type { MentalWellbeingStore } from './mental-wellbeing-repository.js';
import { registerMentalWellbeingRoutes } from './mental-wellbeing-routes.js';
import type { InjectableStore } from './injectable-repository.js';
import { registerInjectableRoutes } from './injectable-routes.js';
import type { GroupRepository } from './group-repository.js';
import { registerGroupRoutes } from './group-routes.js';
import { feedbackInputSchema } from '@fit/contracts';
import {processAvatar} from './avatar.js';
import {saveMedia,readMedia,removeMedia} from './media-storage.js';
import { registerPortalRoutes, type PortalStore } from './portal.js';

const ACCESS_SECONDS = 15 * 60;
const REFRESH_MILLIS = 30 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const publicUser = ({ passwordHash: _, ...user }: PublicUser & { passwordHash: string }): PublicUser => user;
const bodySchemas = {
  register: { type: 'object', required: ['email','password','phone','firstName','lastName'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 254 }, password: { type: 'string', minLength: 8, maxLength: 72 }, phone: { type: 'string', minLength: 10, maxLength: 20 }, firstName: { type: 'string', minLength: 2, maxLength: 60 }, lastName: { type: 'string', minLength: 2, maxLength: 60 } } },
  login: { type: 'object', required: ['email','password'], additionalProperties: false, properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 1, maxLength: 72 } } },
  refresh: { type: 'object', required: ['refreshToken'], additionalProperties: false, properties: { refreshToken: { type: 'string', minLength: 32, maxLength: 512 } } },
} as const;

export async function buildApp(options: { portalStore?: PortalStore; repository?: AuthRepository; workoutRepository?: WorkoutRepository; supplementRepository?: SupplementRepository; medicationRepository?: SupplementRepository; nutritionRepository?: NutritionRepository; cardioRepository?: CardioRepository; shortcutRepository?: ShortcutRepository; mentalWellbeingRepository?: MentalWellbeingStore; injectableRepository?: InjectableStore; groupRepository?:GroupRepository; feedbackRepository?: import("./feedback.js").FeedbackStore; jwtSecret: string }) {
  const app = Fastify({ logger: false, bodyLimit: 1_048_576, trustProxy: process.env.TRUST_PROXY === '1' ? ['loopback', '172.16.0.0/12'] : false });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff').header('x-frame-options', 'DENY').header('referrer-policy', 'no-referrer');
    return payload;
  });
  const repository = options.repository ?? new MemoryAuthRepository();
  await app.register(cors, { origin: process.env.NODE_ENV === 'production' ? (process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ?? false) : true, methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'] });
  await app.register(jwt, { secret: options.jwtSecret });
  app.addHook('onRequest',async(request,reply)=>{
    if(!request.headers.authorization)return;
    try{await request.jwtVerify();}catch{return;}
    if(request.user.sessionHash&&!(await repository.isSessionActive(request.user.sessionHash,request.user.sub)))return reply.code(401).send({code:'UNAUTHORIZED',message:'Sessão inválida ou expirada.'});
  });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
  await app.register(swagger, { openapi: { info: { title: 'Fit API', version: '0.1.0', description: 'API do aplicativo Fit' }, tags: [{ name: 'Autenticação' }], components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } } });
  if (process.env.NODE_ENV !== 'production') await app.register(swaggerUi, { routePrefix: '/docs' });

  const issueTokens = async (user: PublicUser) => {
    const refreshToken = randomBytes(48).toString('base64url');
    await repository.createSession(user.id, tokenHash(refreshToken), Date.now() + REFRESH_MILLIS);
    return { user, accessToken: await app.jwt.sign({ sub: user.id, sessionHash: tokenHash(refreshToken) }, { expiresIn: ACCESS_SECONDS }), refreshToken, expiresIn: ACCESS_SECONDS };
  };
  const secure = async (request: FastifyRequest, reply: FastifyReply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' }); }
  };

  app.post('/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, schema: { tags: ['Autenticação'], summary: 'Cria uma conta', body: bodySchemas.register, response: { 201: authJsonSchema, 400: errorJsonSchema, 409: errorJsonSchema, 429: errorJsonSchema } } }, async (request, reply) => {
    const input = registerInputSchema.parse(request.body);
    if (await repository.findUserByEmail(input.email)) return reply.code(409).send({ code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado.', fieldErrors: { email: ['Este e-mail já está cadastrado.'] } });
    const baseUsername=input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g,'').slice(0,20)||'usuario';
    const user = await repository.createUser({ ...input,username:`${baseUsername}.${randomBytes(3).toString('hex')}`,displayName:`${input.firstName} ${input.lastName}`,avatarUrl:null,birthDate: null, gender: null, estimationSex: null, heightCm: null, activityLevel: null, primaryGoal: null, passwordHash: await bcrypt.hash(input.password, 12) });
    return reply.code(201).send(await issueTokens(publicUser(user)));
  });
  app.post('/auth/login', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } }, schema: { tags: ['Autenticação'], summary: 'Autentica com e-mail e senha', body: bodySchemas.login, response: { 200: authJsonSchema, 400: errorJsonSchema, 401: errorJsonSchema, 429: errorJsonSchema } } }, async (request, reply) => {
    const input = loginInputSchema.parse(request.body);
    const user = await repository.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)) || !(await repository.canAuthenticate(user.id))) return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos ou acesso indisponível.' });
    return issueTokens(publicUser(user));
  });
  app.post('/auth/refresh', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { tags: ['Autenticação'], summary: 'Renova e rotaciona a sessão', body: bodySchemas.refresh, response: { 200: authJsonSchema, 400: errorJsonSchema, 401: errorJsonSchema } } }, async (request, reply) => {
    const { refreshToken } = refreshInputSchema.parse(request.body);
    const nextToken = randomBytes(48).toString('base64url');
    const user = await repository.rotateSession(tokenHash(refreshToken), tokenHash(nextToken), Date.now() + REFRESH_MILLIS);
    if (!user) return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' });
    if (!(await repository.canAuthenticate(user.id))) { await repository.revokeSession(tokenHash(nextToken)); return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' }); }
    return { user, accessToken: await app.jwt.sign({ sub: user.id, sessionHash: tokenHash(nextToken) }, { expiresIn: ACCESS_SECONDS }), refreshToken: nextToken, expiresIn: ACCESS_SECONDS };
  });
  app.get('/auth/me', { preHandler: secure, schema: { tags: ['Autenticação'], summary: 'Retorna o usuário da sessão', security: [{ bearerAuth: [] }], response: { 200: userJsonSchema, 401: errorJsonSchema } } }, async (request, reply) => {
    const user = await repository.findUserById(request.user.sub);
    return user ?? reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' });
  });
  app.patch('/auth/me', { preHandler: secure, schema: { tags: ['Autenticação'], summary: 'Atualiza dados de perfil', security: [{ bearerAuth: [] }], response: { 200: userJsonSchema, 400: errorJsonSchema, 401: errorJsonSchema } } }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    const user = await repository.updateProfile(request.user.sub, input);
    if (!user) return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
    return user;
  });
  app.patch('/me/social-profile',{preHandler:secure},async(request,reply)=>{try{const result=await repository.updateSocialProfile(request.user.sub,updateSocialProfileSchema.parse(request.body));if(result==='username_taken')return reply.code(409).send({code:'CONFLICT',message:'Este nome de usuário já está em uso.'});return result??reply.code(404).send({code:'NOT_FOUND',message:'Usuário não encontrado.'});}catch(error){if(error instanceof UniqueConstraintError)return reply.code(409).send({code:'CONFLICT',message:'Este nome de usuário já está em uso.'});throw error;}});
  app.get('/users/search',{preHandler:secure},request=>{const query=z.strictObject({username:socialUsernameSchema}).parse(request.query);return repository.searchSocialUsers(request.user.sub,query.username);});
  app.post('/auth/logout', { schema: { tags: ['Autenticação'], summary: 'Encerra a sessão', body: bodySchemas.refresh, response: { 204: { type: 'null' }, 400: errorJsonSchema } } }, async (request, reply) => {
    const { refreshToken } = refreshInputSchema.parse(request.body); await repository.revokeSession(tokenHash(refreshToken)); return reply.code(204).send();
  });
  app.put('/me/avatar',{preHandler:secure,bodyLimit:14_500_000,config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(request,reply)=>{
    const {photoDataUrl}=z.strictObject({photoDataUrl:z.string().max(14_000_000).nullable()}).parse(request.body);
    let avatarUrl:string|null=null;
    if(photoDataUrl){try{const processed=await processAvatar(photoDataUrl);avatarUrl=`/media/avatars/${await saveMedia(Buffer.from(processed.split(',')[1],'base64'))}`}catch{return reply.code(400).send({code:'INVALID_INPUT',message:'Selecione uma imagem JPEG, PNG ou WebP válida de até 10 MB.'})}}
    const previous=await repository.findUserById(request.user.sub);
    let result;
    try{result=await repository.updateSocialProfile(request.user.sub,{avatarUrl});}catch(error){if(avatarUrl)await removeMedia(avatarUrl.split('/').at(-1)!);throw error;}
    if(previous?.avatarUrl?.startsWith('/media/avatars/'))await removeMedia(previous.avatarUrl.split('/').at(-1)!).catch(()=>app.log.warn('Falha ao remover avatar substituído.'));
    return result;
  });
  app.get('/media/avatars/:key',async(request,reply)=>{const {key}=z.strictObject({key:z.string().regex(/^[a-f0-9-]{36}\.webp$/)}).parse(request.params);try{return reply.header('content-type','image/webp').header('cache-control','public, max-age=86400, immutable').send(await readMedia(key));}catch{return reply.code(404).send({code:'NOT_FOUND',message:'Foto não encontrada.'});}});
  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  if (options.portalStore) await registerPortalRoutes(app, options.portalStore, secure);
  if(options.feedbackRepository) app.post('/me/feedback',{preHandler:secure,config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(request,reply)=>reply.code(201).send({id:await options.feedbackRepository!.create(request.user.sub,feedbackInputSchema.parse(request.body))}));
  if (options.workoutRepository) await registerWorkoutRoutes(app, options.workoutRepository, secure,options.groupRepository);
  if (options.supplementRepository) await registerSupplementRoutes(app, options.supplementRepository, secure);
  if (options.medicationRepository) await registerSupplementRoutes(app, options.medicationRepository, secure);
  if (options.nutritionRepository) await registerNutritionRoutes(app, options.nutritionRepository, secure);
  if (options.cardioRepository) await registerCardioRoutes(app, options.cardioRepository, secure,options.groupRepository);
  if (options.shortcutRepository) await registerShortcutRoutes(app, options.shortcutRepository, secure);
  if (options.mentalWellbeingRepository) await registerMentalWellbeingRoutes(app, options.mentalWellbeingRepository, secure);
  if (options.injectableRepository) await registerInjectableRoutes(app, options.injectableRepository, secure);
  if(options.groupRepository)await registerGroupRoutes(app,options.groupRepository,secure);
  app.setErrorHandler((error, _request, reply) => {
    if ((error as { statusCode?: number }).statusCode === 413) return reply.code(413).send({ code: 'PAYLOAD_TOO_LARGE', message: 'O arquivo ou conteúdo enviado ultrapassa o limite permitido.' });
    if ((error as { statusCode?: number }).statusCode === 415) return reply.code(415).send({ code: 'INVALID_INPUT', message: 'Formato de conteúdo não suportado.' });
    if ((error as { statusCode?: number }).statusCode === 429) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
    if (error instanceof ZodError || (error as { validation?: unknown }).validation) return reply.code(400).send({ code: 'INVALID_INPUT', message: 'Revise os dados informados.', fieldErrors: error instanceof ZodError ? error.flatten().fieldErrors : undefined });
    if (error instanceof UniqueConstraintError) return reply.code(409).send({ code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado.', fieldErrors: { email: ['Este e-mail já está cadastrado.'] } });
    app.log.error(error); return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.' });
  });
  return app;
}

declare module '@fastify/jwt' { interface FastifyJWT { payload: { sub: string; sessionHash?: string }; user: { sub: string; sessionHash?: string } } }
