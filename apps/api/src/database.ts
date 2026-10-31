import { Sequelize } from 'sequelize';

export type DatabaseConfig = { host: string; port: number; username: string; password: string; database: string; ssl?: boolean };
export function createDatabase(config: DatabaseConfig) {
  return new Sequelize(config.database, config.username, config.password, {
    host: config.host, port: config.port, dialect: 'mysql', logging: false,
    dialectOptions: config.ssl ? { ssl: { rejectUnauthorized: true } } : undefined,
    pool: { max: 10, min: 0, acquire: 20_000, idle: 10_000 },
  });
}
