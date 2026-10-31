import type { QueryInterface } from 'sequelize';
import { DataTypes } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('users', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    first_name: { type: DataTypes.STRING(60), allowNull: false },
    last_name: { type: DataTypes.STRING(60), allowNull: false },
    password_hash: { type: DataTypes.STRING(100), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('sessions', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.BIGINT, allowNull: false },
    revoked_at: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex('sessions', ['user_id'], { name: 'sessions_user_id_idx' });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable('sessions');
  await context.dropTable('users');
}
