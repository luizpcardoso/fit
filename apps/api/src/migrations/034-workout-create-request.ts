import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('workout_plans', 'request_id', { type: DataTypes.STRING(36), allowNull: true });
  await q.addIndex('workout_plans', ['user_id', 'request_id'], { unique: true, name: 'workout_owner_request_unique' });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeIndex('workout_plans', 'workout_owner_request_unique');
  await q.removeColumn('workout_plans', 'request_id');
}
