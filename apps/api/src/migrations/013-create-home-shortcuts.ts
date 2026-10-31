import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('home_shortcuts', {
    user_id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    items_json: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable('home_shortcuts');
}
