import { DataTypes, type QueryInterface } from 'sequelize';

// NULL keeps legacy items scheduled every day; reminders stay on unless the user turns them off.
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('supplements', 'weekdays_json', { type: DataTypes.TEXT, allowNull: true });
  await q.addColumn('supplements', 'remind', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn('supplements', 'remind');
  await q.removeColumn('supplements', 'weekdays_json');
}
