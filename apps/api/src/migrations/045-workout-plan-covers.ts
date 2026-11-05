import { DataTypes, QueryTypes, type QueryInterface } from 'sequelize';
import { defaultWorkoutCover } from '@fit/contracts';
export async function up({ context: q }: { context: QueryInterface }) {
  for (const table of ['workout_plans', 'suggested_workout_plans']) await q.addColumn(table, 'cover_id', { type: DataTypes.STRING(32), allowNull: true });
  await backfillWorkoutCovers(q);
}
export async function backfillWorkoutCovers(q: QueryInterface) {
  const db = q.sequelize;
  for (const table of ['suggested_workout_plans'] as const) {
    const rows = await db.query<{ id: string; name: string; audience?: string; goal?: string }>(`SELECT id,name${table === 'suggested_workout_plans' ? ',audience,goal' : ''} FROM ${table}`, { type: QueryTypes.SELECT });
    for (const row of rows) await db.query(`UPDATE ${table} SET cover_id=? WHERE id=? AND cover_id IS NULL`, { replacements: [defaultWorkoutCover(row.name, row.audience, row.goal), row.id] });
  }
  const contents = await db.query<{ id: string; name: string; data: unknown }>("SELECT id,name,data FROM portal_content WHERE kind='workout'", { type: QueryTypes.SELECT });
  for (const row of contents) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Object.hasOwn(data, 'coverId')) continue;
    const [source] = await db.query<{ cover_id: string }>('SELECT cover_id FROM suggested_workout_plans WHERE id=?', { replacements: [row.id], type: QueryTypes.SELECT });
    await db.query('UPDATE portal_content SET data=? WHERE id=?', { replacements: [JSON.stringify({ ...data, coverId: source?.cover_id ?? defaultWorkoutCover(row.name) }), row.id] });
  }
  // Cosmetic snapshots only: keep versions, prescription, consent and active sessions unchanged.
  const assignments = await db.query<{ id: string; snapshot: unknown; workout_plan_id: string | null; source_id:string }>("SELECT id,snapshot,workout_plan_id,source_id FROM professional_assignments WHERE kind='workout'", { type: QueryTypes.SELECT });
  for (const row of assignments) {
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot as {name:string;data:Record<string,unknown>};
    if (!snapshot?.data || Object.hasOwn(snapshot.data, 'coverId')) continue;
    const [source] = await db.query<{data:unknown}>('SELECT data FROM portal_content WHERE id=?', {replacements:[row.source_id],type:QueryTypes.SELECT});
    const sourceData = source ? typeof source.data === 'string' ? JSON.parse(source.data) : source.data as Record<string,unknown> : null;
    const coverId = sourceData?.coverId ?? defaultWorkoutCover(snapshot.name);
    await db.query('UPDATE professional_assignments SET snapshot=? WHERE id=?', { replacements: [JSON.stringify({ ...snapshot, data: { ...snapshot.data, coverId } }), row.id] });
    if (row.workout_plan_id) await db.query('UPDATE workout_plans SET cover_id=? WHERE id=? AND cover_id IS NULL', { replacements: [coverId, row.workout_plan_id] });
  }
  const remaining = await db.query<{id:string;name:string}>('SELECT id,name FROM workout_plans WHERE cover_id IS NULL', {type:QueryTypes.SELECT});
  for (const row of remaining) await db.query('UPDATE workout_plans SET cover_id=? WHERE id=? AND cover_id IS NULL', {replacements:[defaultWorkoutCover(row.name),row.id]});
}
export async function down({ context: q }: { context: QueryInterface }) {
  for (const table of ['workout_plans', 'suggested_workout_plans']) await q.removeColumn(table, 'cover_id');
}
