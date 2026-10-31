import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { buildApp } from './app.js';
import { createDatabase } from './database.js';
import { migrateDatabase } from './migrate.js';
import { SequelizeAuthRepository } from './repository.js';
import { WorkoutRepository } from './workout-repository.js';
import { SupplementRepository } from './supplement-repository.js';
import { NutritionRepository } from './nutrition-repository.js';
import { CardioRepository } from './cardio-repository.js';
import { ShortcutRepository } from './shortcut-repository.js';
import { MentalWellbeingRepository } from './mental-wellbeing-repository.js';
import { InjectableRepository } from './injectable-repository.js';
import { GroupRepository } from './group-repository.js';
import { FeedbackRepository } from './feedback.js';
import {saveMedia} from './media-storage.js';
import {QueryTypes} from 'sequelize';
import { SequelizePortalStore } from './portal.js';
import { ProfessionalManagement, registerProfessionalManagement } from './professional-management.js';
import { PortalContentService, registerPortalContent } from './portal-content.js';
import { readFile } from 'node:fs/promises';
import { registerUpdateRoutes } from './update-routes.js';

config({ path: new URL('../.env', import.meta.url) });

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.JWT_SECRET) throw new Error('JWT_SECRET é obrigatório em produção.');
const jwtSecret = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} é obrigatório.`);
const database = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
await database.authenticate();
await migrateDatabase(database);
const groupRepository=new GroupRepository(database);
await groupRepository.purgeExpiredPhotos();
while(await groupRepository.migratePhotos()) { /* bounded batches */ }
const legacyAvatars=await database.query<{id:string;avatar_url:string}>("SELECT id,avatar_url FROM users WHERE avatar_url LIKE 'data:image/%'",{type:QueryTypes.SELECT});
for(const user of legacyAvatars){const key=await saveMedia(Buffer.from(user.avatar_url.split(',')[1],'base64'));await database.query('UPDATE users SET avatar_url=? WHERE id=?',{replacements:[`/media/avatars/${key}`,user.id],type:QueryTypes.UPDATE});}
const photoCleanup=setInterval(()=>{void groupRepository.purgeExpiredPhotos().catch(()=>console.error('Falha ao limpar posts expirados.'));},60_000);
photoCleanup.unref();
const app = await buildApp({ repository: new SequelizeAuthRepository(database), workoutRepository: new WorkoutRepository(database), supplementRepository: new SupplementRepository(database), medicationRepository: new SupplementRepository(database, 'medication'), nutritionRepository: new NutritionRepository(database), cardioRepository: new CardioRepository(database), shortcutRepository: new ShortcutRepository(database), mentalWellbeingRepository: new MentalWellbeingRepository(database), injectableRepository: new InjectableRepository(database),groupRepository, feedbackRepository:new FeedbackRepository(database), jwtSecret });
if (process.env.UPDATES_DIR) registerUpdateRoutes(app, process.env.UPDATES_DIR, await readFile(new URL('../../mobile/certs/updates.pem', import.meta.url), 'utf8'));
await (await import('./portal.js')).registerPortalRoutes(app, new SequelizePortalStore(database), async (request, reply) => {
  try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' }); }
});
app.addHook('onClose', async () => {clearInterval(photoCleanup);await database.close();});
await registerProfessionalManagement(app, new ProfessionalManagement(database), async (request, reply) => {
  try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Sessão inválida ou expirada.' }); }
});
await registerPortalContent(app, new PortalContentService(new ProfessionalManagement(database)), async (request, reply) => {
  try { await request.jwtVerify(); } catch { return reply.code(401).send({code:'UNAUTHORIZED',message:'Sessão inválida ou expirada.'}); }
});
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 3333) });
