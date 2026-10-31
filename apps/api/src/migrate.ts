import { SequelizeStorage, Umzug } from 'umzug';
import type { Sequelize } from 'sequelize';
import { fileURLToPath } from 'node:url';

export async function migrateDatabase(sequelize: Sequelize) {
  const migrator = new Umzug({
    migrations: { glob: fileURLToPath(new URL('./migrations/*.ts', import.meta.url)) },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
    logger: undefined,
  });
  await migrator.up();
}
