import { DataTypes, type QueryInterface } from "sequelize";
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn("portal_accounts", "type_id", {
    type: DataTypes.STRING(36),
    allowNull: true,
    references: { model: "professional_types", key: "id" },
  });
  await q.addColumn("portal_accounts", "capabilities", {
    type: DataTypes.JSON,
    allowNull: true,
  });
  await q.addColumn("portal_accounts", "activated_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await q.addColumn("portal_accounts", "temporary_expires_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await q.createTable("professional_relationships", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    professional_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    student_id: {
      type: DataTypes.STRING(36),
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    invited_email: { type: DataTypes.STRING(254), allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "active", "declined", "ended"),
      allowNull: false,
    },
    capabilities: { type: DataTypes.JSON, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex("professional_relationships", ["professional_id", "status"]);
  await q.addIndex("professional_relationships", ["invited_email", "status"]);
  await q.createTable("professional_consents", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    relationship_id: { type: DataTypes.STRING(36), allowNull: false },
    actor_id: { type: DataTypes.STRING(36), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    capabilities: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable("professional_consents");
  await q.dropTable("professional_relationships");
  for (const name of [
    "temporary_expires_at",
    "activated_at",
    "capabilities",
    "type_id",
  ])
    await q.removeColumn("portal_accounts", name);
}
