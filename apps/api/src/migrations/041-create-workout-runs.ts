import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('workout_runs', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    snapshot: { type: DataTypes.JSON, allowNull: false },
    progress: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false },
    version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    mutation_id: { type: DataTypes.STRING(36), allowNull: false },
    history_session_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'workout_sessions', key: 'id' }, onDelete: 'SET NULL' },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex('workout_runs', ['user_id', 'status'], { name: 'workout_runs_owner_status' });
}
export async function down({ context: q }: { context: QueryInterface }) { await q.dropTable('workout_runs'); }
