import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.addColumn('users', 'birth_date', { type: DataTypes.DATEONLY, allowNull: true });
  await context.addColumn('users', 'gender', { type: DataTypes.STRING(24), allowNull: true });
  await context.addColumn('users', 'height_cm', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
  await context.addColumn('users', 'activity_level', { type: DataTypes.STRING(24), allowNull: true });
  await context.addColumn('users', 'primary_goal', { type: DataTypes.STRING(24), allowNull: true });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.removeColumn('users', 'primary_goal');
  await context.removeColumn('users', 'activity_level');
  await context.removeColumn('users', 'height_cm');
  await context.removeColumn('users', 'gender');
  await context.removeColumn('users', 'birth_date');
}
