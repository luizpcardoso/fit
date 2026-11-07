import { DataTypes, type QueryInterface } from 'sequelize';

// One validated JSON document per account; readers fall back to defaults for unknown or invalid content.
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('user_preferences', {
    user_id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    preferences_json: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable('user_preferences');
}
