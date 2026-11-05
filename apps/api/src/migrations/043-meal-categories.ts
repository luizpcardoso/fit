import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: q }: { context: QueryInterface }) {
  for (const table of ['meals', 'favorite_meals']) await q.addColumn(table, 'category', { type: DataTypes.STRING(24), allowNull: true });
}
export async function down({ context: q }: { context: QueryInterface }) {
  for (const table of ['favorite_meals', 'meals']) await q.removeColumn(table, 'category');
}
