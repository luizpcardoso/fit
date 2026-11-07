import { DataTypes, type QueryInterface } from 'sequelize';

// A dismissal skips one scheduled dose/application on one day without deleting history.
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('supplement_dismissals', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    supplement_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'supplements', key: 'id' }, onDelete: 'CASCADE' },
    activity_date: { type: DataTypes.DATEONLY, allowNull: false }, slot: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    dismissed_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addConstraint('supplement_dismissals', { fields: ['supplement_id', 'activity_date', 'slot'], type: 'unique', name: 'supplement_dismissals_daily_slot_unique' });
  await q.addIndex('supplement_dismissals', ['user_id', 'activity_date'], { name: 'supplement_dismissals_user_date_idx' });
  await q.createTable('injectable_dismissals', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    injectable_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'injectables', key: 'id' }, onDelete: 'CASCADE' },
    activity_date: { type: DataTypes.DATEONLY, allowNull: false },
    dismissed_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addConstraint('injectable_dismissals', { fields: ['injectable_id', 'activity_date'], type: 'unique', name: 'injectable_dismissals_daily_unique' });
  await q.addIndex('injectable_dismissals', ['user_id', 'activity_date'], { name: 'injectable_dismissals_user_date_idx' });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable('injectable_dismissals');
  await q.dropTable('supplement_dismissals');
}
