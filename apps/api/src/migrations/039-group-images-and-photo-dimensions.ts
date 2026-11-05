import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.addColumn('groups', 'avatar_path', { type: DataTypes.STRING(100), allowNull: true });
  await context.addColumn('groups', 'cover_path', { type: DataTypes.STRING(100), allowNull: true });
  await context.addColumn('group_posts', 'photo_width', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
  await context.addColumn('group_posts', 'photo_height', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.removeColumn('group_posts', 'photo_height');
  await context.removeColumn('group_posts', 'photo_width');
  await context.removeColumn('groups', 'cover_path');
  await context.removeColumn('groups', 'avatar_path');
}
