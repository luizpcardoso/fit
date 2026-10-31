import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('nutrition_goals', {
    user_id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    target_calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context: q }: { context: QueryInterface }) { await q.dropTable('nutrition_goals'); }
