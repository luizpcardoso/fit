import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({context}: {context: QueryInterface}) {
  await context.addColumn('users', 'count_mental_check_in', {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true});
}
export async function down({context}: {context: QueryInterface}) {
  await context.removeColumn('users', 'count_mental_check_in');
}
