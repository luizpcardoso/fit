import { QueryTypes, type Sequelize } from 'sequelize';
import { userPreferencesSchema, type UpdateUserPreferences, type UserPreferences } from '@fit/contracts';

type PreferenceRow = { preferences_json: string };
const parse = (json: string | undefined): UserPreferences => {
  try { const parsed = userPreferencesSchema.safeParse(json ? JSON.parse(json) : {}); return parsed.success ? parsed.data : userPreferencesSchema.parse({}); }
  catch { return userPreferencesSchema.parse({}); }
};

export interface PreferenceStore {
  get(userId: string): Promise<UserPreferences>;
  update(userId: string, input: UpdateUserPreferences): Promise<UserPreferences>;
}

export class PreferenceRepository implements PreferenceStore {
  constructor(private db: Sequelize) {}

  async get(userId: string) {
    const [row] = await this.db.query<PreferenceRow>('SELECT preferences_json FROM user_preferences WHERE user_id=?', { replacements: [userId], type: QueryTypes.SELECT });
    return parse(row?.preferences_json);
  }

  // Locked read-merge-write so concurrent edits of different keys do not overwrite each other.
  async update(userId: string, input: UpdateUserPreferences) {
    return this.db.transaction(async transaction => {
      const [row] = await this.db.query<PreferenceRow>('SELECT preferences_json FROM user_preferences WHERE user_id=? FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      const next = userPreferencesSchema.parse({ ...parse(row?.preferences_json), ...input });
      await this.db.query('INSERT INTO user_preferences (user_id,preferences_json,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json),updated_at=UTC_TIMESTAMP()', { replacements: [userId, JSON.stringify(next)], type: QueryTypes.INSERT, transaction });
      return next;
    });
  }
}
