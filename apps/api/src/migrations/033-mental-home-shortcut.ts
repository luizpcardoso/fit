import type { QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  // Add once, retaining the user's existing order. Later edits remain entirely user-controlled.
  await q.sequelize.query(`UPDATE home_shortcuts SET items_json=JSON_ARRAY_APPEND(items_json,'$', 'mental') WHERE JSON_VALID(items_json) AND JSON_LENGTH(items_json)<5 AND NOT JSON_CONTAINS(items_json, '"mental"')`);
}
export async function down() { /* Keep user preferences on rollback. */ }
