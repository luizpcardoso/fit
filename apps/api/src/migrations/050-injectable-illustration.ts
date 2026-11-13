import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('injectables', 'illustration', { type: DataTypes.STRING(32), allowNull: true });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn('injectables', 'illustration');
}
