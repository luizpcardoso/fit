import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({context}: {context: QueryInterface}) {
  await context.addColumn('professional_relationships', 'notification_read_at', {type: DataTypes.DATE, allowNull: true});
}
export async function down({context}: {context: QueryInterface}) {
  await context.removeColumn('professional_relationships', 'notification_read_at');
}
