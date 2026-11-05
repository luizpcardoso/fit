import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('workout_divisions', 'illustration_id', { type: DataTypes.STRING(32), allowNull: true });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn('workout_divisions', 'illustration_id');
}
