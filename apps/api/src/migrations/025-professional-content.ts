import { DataTypes, type QueryInterface } from "sequelize";
export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable("portal_content", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    owner_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    scope: { type: DataTypes.STRING(10), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    data: { type: DataTypes.JSON, allowNull: false },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex("portal_content", ["owner_id", "kind"]);
  await q.createTable("portal_content_versions", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    content_id: { type: DataTypes.STRING(36), allowNull: false },
    revision: { type: DataTypes.INTEGER, allowNull: false },
    snapshot: { type: DataTypes.JSON, allowNull: false },
    actor_id: { type: DataTypes.STRING(36), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex("portal_content_versions", ["content_id", "revision"], {
    unique: true,
  });
  await q.createTable("professional_assignments", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    author_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    student_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    relationship_id: { type: DataTypes.STRING(36), allowNull: false },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false },
    source_id: { type: DataTypes.STRING(36), allowNull: false },
    source_revision: { type: DataTypes.INTEGER, allowNull: false },
    snapshot: { type: DataTypes.JSON, allowNull: false },
    workout_plan_id: { type: DataTypes.STRING(36), allowNull: true },
    replace_id: { type: DataTypes.STRING(36), allowNull: true },
    request_id: { type: DataTypes.STRING(36), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex("professional_assignments", ["student_id", "status"]);
  await q.addIndex("professional_assignments", ["relationship_id", "status"]);
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable("professional_assignments");
  await q.dropTable("portal_content_versions");
  await q.dropTable("portal_content");
}
