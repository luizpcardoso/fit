import { config } from "dotenv";
import { QueryTypes } from "sequelize";
import { createDatabase } from "./database.js";
import { migrateDatabase } from "./migrate.js";

config({ path: new URL("../.env", import.meta.url) });
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@"))
  throw new Error(
    "Uso: npm run portal:admin --workspace=@fit/api -- email-da-conta-existente",
  );
for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME"])
  if (!process.env[key]) throw new Error(`${key} é obrigatório.`);
const database = createDatabase({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  ssl: process.env.DB_SSL === "true",
});
try {
  await database.authenticate();
  await migrateDatabase(database);
  const users = await database.query<{ id: string }>(
    "SELECT id FROM users WHERE email=?",
    { replacements: [email], type: QueryTypes.SELECT },
  );
  if (!users[0])
    throw new Error(
      "Conta não encontrada. Cadastre a conta no aplicativo primeiro.",
    );
  await database.query(
    "INSERT INTO portal_accounts (user_id,role,suspended) VALUES (?,'admin',FALSE) ON DUPLICATE KEY UPDATE role='admin',suspended=FALSE",
    { replacements: [users[0].id] },
  );
  console.info("Acesso administrativo concedido à conta informada.");
} finally {
  await database.close();
}
