import type { QueryInterface } from "sequelize";

export async function up({ context: q }: { context: QueryInterface }) {
  await q.sequelize.query(`
    INSERT INTO portal_content
      (id,owner_id,kind,scope,name,data,revision,archived,created_at,updated_at)
    SELECT e.id,admin.user_id,'exercise','global',e.name,
      JSON_OBJECT(
        'category', COALESCE(e.category,'strength'),
        'equipment', COALESCE(e.equipment,''),
        'primaryMuscle', COALESCE(e.primary_muscle,''),
        'notes', ''
      ),
      1,FALSE,e.created_at,e.updated_at
    FROM exercises e
    JOIN (SELECT user_id FROM portal_accounts WHERE role='admin' LIMIT 1) admin
    LEFT JOIN portal_content p ON p.id=e.id
    WHERE e.source='catalog' AND p.id IS NULL
  `);
}

export async function down({ context: q }: { context: QueryInterface }) {
  await q.sequelize.query(
    "DELETE p FROM portal_content p JOIN exercises e ON e.id=p.id LEFT JOIN portal_content_versions v ON v.content_id=p.id WHERE p.kind='exercise' AND p.scope='global' AND e.source='catalog' AND v.id IS NULL",
  );
}
