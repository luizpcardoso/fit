import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('nutrition_sync_receipts', {
    user_id: { type: DataTypes.STRING(36), allowNull: false, primaryKey: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    request_id: { type: DataTypes.STRING(36), allowNull: false, primaryKey: true },
    meal_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'meals', key: 'id' }, onDelete: 'SET NULL' },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context: q }: { context: QueryInterface }) { await q.dropTable('nutrition_sync_receipts'); }
