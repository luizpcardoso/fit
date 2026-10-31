import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('supplements', 'deleted_at', { type: DataTypes.DATE, allowNull: true });
  await q.addIndex('supplements', ['user_id', 'kind', 'deleted_at', 'active', 'name', 'id'], { name: 'supplements_owner_page_idx' });
  await q.addIndex('body_measurements', ['user_id', 'measurement_date', 'created_at', 'id'], { name: 'measurements_owner_page_idx' });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeIndex('body_measurements', 'measurements_owner_page_idx');
  await q.removeIndex('supplements', 'supplements_owner_page_idx');
  await q.removeColumn('supplements', 'deleted_at');
}
