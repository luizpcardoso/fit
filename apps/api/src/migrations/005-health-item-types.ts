import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  // Existing IDs, schedules and intake history are preserved.
  await context.addColumn('supplements', 'kind', { type: DataTypes.ENUM('supplement', 'medication'), allowNull: false, defaultValue: 'supplement' });
  await context.addColumn('supplements', 'strength', { type: DataTypes.STRING(100), allowNull: true });
  await context.changeColumn('supplements', 'unit', { type: DataTypes.ENUM('capsule', 'tablet', 'g', 'mg', 'ml', 'dose', 'scoop', 'drop', 'other'), allowNull: true });
  await context.addIndex('supplements', ['user_id', 'kind', 'active'], { name: 'health_items_owner_kind_active_idx' });
}
