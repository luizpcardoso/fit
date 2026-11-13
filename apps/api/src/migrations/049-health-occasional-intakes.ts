import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('supplements', 'usage_mode', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'recurring' });
  await q.addColumn('supplements', 'illustration', { type: DataTypes.STRING(16), allowNull: true });
  await q.createTable('supplement_occasional_intakes', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    supplement_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'supplements', key: 'id' }, onDelete: 'CASCADE' },
    operation_id: { type: DataTypes.STRING(36), allowNull: false },
    intake_date: { type: DataTypes.DATEONLY, allowNull: false },
    canceled_at: { type: DataTypes.DATE, allowNull: true },
    intake_time: { type: DataTypes.STRING(5), allowNull: false },
  });
  await q.addConstraint('supplement_occasional_intakes', { fields: ['supplement_id', 'operation_id'], type: 'unique', name: 'occasional_item_operation_unique' });
  await q.addIndex('supplement_occasional_intakes', ['user_id', 'intake_date'], { name: 'occasional_user_date_idx' });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable('supplement_occasional_intakes');
  await q.removeColumn('supplements', 'illustration');
  await q.removeColumn('supplements', 'usage_mode');
}
