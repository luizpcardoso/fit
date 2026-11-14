import { DataTypes, type QueryInterface } from 'sequelize';

const previous = ['invite', 'comment', 'role_changed', 'removed', 'report_resolved'];

export async function up({ context: q }: { context: QueryInterface }) {
  await q.changeColumn('group_notifications', 'type', { type: DataTypes.ENUM(...previous, 'reaction'), allowNull: false });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.bulkDelete('group_notifications', { type: 'reaction' });
  await q.changeColumn('group_notifications', 'type', { type: DataTypes.ENUM(...previous), allowNull: false });
}
