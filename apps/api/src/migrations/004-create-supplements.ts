import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('supplements', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING(100), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    unit: { type: DataTypes.ENUM('capsule', 'tablet', 'g', 'mg', 'ml', 'dose', 'scoop', 'other'), allowNull: true },
    daily_frequency: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    times: { type: DataTypes.JSON, allowNull: false },
    notes: { type: DataTypes.STRING(500), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('supplement_intakes', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    supplement_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'supplements', key: 'id' }, onDelete: 'CASCADE' },
    intake_date: { type: DataTypes.DATEONLY, allowNull: false }, slot: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    consumed_at: { type: DataTypes.DATE, allowNull: false }, created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addConstraint('supplement_intakes', { fields: ['supplement_id', 'intake_date', 'slot'], type: 'unique', name: 'supplement_intakes_daily_slot_unique' });
  await context.addIndex('supplements', ['user_id', 'active'], { name: 'supplements_user_active_idx' });
  await context.addIndex('supplement_intakes', ['user_id', 'intake_date'], { name: 'supplement_intakes_user_date_idx' });
}
export async function down({ context }: { context: QueryInterface }) { await context.dropTable('supplement_intakes'); await context.dropTable('supplements'); }
