import type { QueryInterface } from 'sequelize';
import { DataTypes } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('exercises', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false }, owner_user_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING(100), allowNull: false }, source: { type: DataTypes.ENUM('catalog', 'custom'), allowNull: false }, created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('workout_plans', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false }, user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING(80), allowNull: false }, is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, status: { type: DataTypes.ENUM('available', 'archived'), allowNull: false, defaultValue: 'available' }, created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('workout_divisions', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false }, plan_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'workout_plans', key: 'id' }, onDelete: 'CASCADE' },
    label: { type: DataTypes.STRING(5), allowNull: false }, name: { type: DataTypes.STRING(80), allowNull: false }, position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('workout_plan_exercises', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false }, division_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'workout_divisions', key: 'id' }, onDelete: 'CASCADE' }, exercise_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'exercises', key: 'id' }, onDelete: 'SET NULL' },
    exercise_name: { type: DataTypes.STRING(100), allowNull: false }, source: { type: DataTypes.ENUM('catalog', 'custom'), allowNull: false }, position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, sets: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, reps: { type: DataTypes.STRING(30), allowNull: false }, load_value: { type: DataTypes.DECIMAL(7, 2), allowNull: true }, rest_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, notes: { type: DataTypes.STRING(500), allowNull: true }, created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.createTable('workout_sessions', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false }, user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' }, plan_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'workout_plans', key: 'id' }, onDelete: 'SET NULL' }, division_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'workout_divisions', key: 'id' }, onDelete: 'SET NULL' },
    plan_name: { type: DataTypes.STRING(80), allowNull: false }, division_name: { type: DataTypes.STRING(80), allowNull: false }, division_label: { type: DataTypes.STRING(5), allowNull: false }, performed_on: { type: DataTypes.DATEONLY, allowNull: false }, status: { type: DataTypes.ENUM('completed', 'cancelled'), allowNull: false }, completion_mode: { type: DataTypes.ENUM('quick', 'detailed'), allowNull: false }, completed_exercise_ids: { type: DataTypes.JSON, allowNull: false }, created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex('workout_plans', ['user_id', 'is_active'], { name: 'workout_plans_user_active_idx' });
  await context.addIndex('workout_sessions', ['user_id', 'performed_on'], { name: 'workout_sessions_user_date_idx' });
  const names = ['Agachamento livre', 'Supino reto', 'Levantamento terra', 'Remada curvada', 'Desenvolvimento de ombros', 'Rosca direta', 'Tríceps na polia', 'Leg press', 'Cadeira extensora', 'Mesa flexora', 'Elevação lateral', 'Puxada frontal'];
  await context.bulkInsert('exercises', names.map((name, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, owner_user_id: null, name, source: 'catalog', created_at: new Date(), updated_at: new Date() })));
}
export async function down({ context }: { context: QueryInterface }) { await context.dropTable('workout_sessions'); await context.dropTable('workout_plan_exercises'); await context.dropTable('workout_divisions'); await context.dropTable('workout_plans'); await context.dropTable('exercises'); }
