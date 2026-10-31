import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.addColumn('workout_plans', 'valid_until', { type: DataTypes.DATE, allowNull: true, defaultValue: null });
}
export async function down({ context }: { context: QueryInterface }) {
  await context.removeColumn('workout_plans', 'valid_until');
}
