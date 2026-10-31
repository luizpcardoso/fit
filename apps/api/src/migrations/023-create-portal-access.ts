import { DataTypes, type QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable("portal_accounts", {
    user_id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    role: { type: DataTypes.ENUM("admin", "professional"), allowNull: false },
    suspended: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });
  await context.createTable("professional_types", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    capabilities: { type: DataTypes.JSON, allowNull: false },
  });
  await context.createTable("portal_audit", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    actor_id: { type: DataTypes.STRING(36), allowNull: false },
    action: { type: DataTypes.STRING(80), allowNull: false },
    resource_id: { type: DataTypes.STRING(36), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable("portal_audit");
  await context.dropTable("professional_types");
  await context.dropTable("portal_accounts");
}
