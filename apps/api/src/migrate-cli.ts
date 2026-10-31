import { config } from 'dotenv';
import { createDatabase } from './database.js';
import { migrateDatabase } from './migrate.js';

config({ path: new URL('../.env', import.meta.url) });

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} é obrigatório.`);
const database = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
try { await database.authenticate(); await migrateDatabase(database); } finally { await database.close(); }
