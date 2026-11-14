import { DataTypes, type QueryInterface } from 'sequelize';

/** Per person and group: whether their weekly workout count appears in the group's ranking. Off unless they turn it on. */
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('group_share_preferences', 'show_in_ranking', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn('group_share_preferences', 'show_in_ranking');
}
