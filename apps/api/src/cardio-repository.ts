import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize } from 'sequelize';
import type { CardioActivity, CardioIntensity, CardioSession, CardioSessionInput } from '@fit/contracts';

export const cardioMetValues: Record<CardioActivity, Record<CardioIntensity, number>> = {
  walking: { light: 2.8, moderate: 3.8, intense: 4.8 },
  running: { light: 6.5, moderate: 8.5, intense: 11 },
  cycling: { light: 4.3, moderate: 7, intense: 9 },
  stairs: { light: 4.5, moderate: 6.8, intense: 9.3 },
  spinning: { light: 4, moderate: 6.8, intense: 9 },
};

export function estimateCardioCalories(met: number, weightKg: number, durationMinutes: number) {
  return Math.max(1, Math.round(met * weightKg * durationMinutes / 60));
}

type CardioRow = {
  id: string; session_date: string | Date; mode: CardioSession['mode']; activity: CardioActivity | null;
  intensity: CardioIntensity | null; duration_minutes: number | null; weight_kg: string | null;
  met: string | null; calories: number; source: string | null; created_at: Date; updated_at: Date;
};
const columns = 'id,session_date,mode,activity,intensity,duration_minutes,weight_kg,met,calories,source,created_at,updated_at';
const dateOnly = (value: string | Date) => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
const mapCardio = (row: CardioRow): CardioSession => ({
  id: row.id, date: dateOnly(row.session_date), mode: row.mode, activity: row.activity, intensity: row.intensity,
  durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes), weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
  met: row.met == null ? null : Number(row.met), calories: Number(row.calories), source: row.source,
  createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
});

export class CardioRepository {
  constructor(private db: Sequelize) {}

  async list(userId: string, date: string) {
    const rows = await this.db.query<CardioRow>(`SELECT ${columns} FROM cardio_sessions WHERE user_id=? AND session_date=? ORDER BY created_at DESC,id DESC`, { replacements: [userId, date], type: QueryTypes.SELECT });
    return rows.map(mapCardio);
  }

  async create(userId: string, input: CardioSessionInput) {
    const id = randomUUID();
    const estimated = input.mode === 'estimated';
    const met = estimated ? cardioMetValues[input.activity][input.intensity] : null;
    const calories = estimated ? estimateCardioCalories(met!, input.weightKg, input.durationMinutes) : Math.round(input.calories);
    await this.db.query('INSERT INTO cardio_sessions (id,user_id,session_date,mode,activity,intensity,duration_minutes,weight_kg,met,calories,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', {
      replacements: [id, userId, input.date, input.mode, estimated ? input.activity : null, estimated ? input.intensity : null, input.durationMinutes ?? null, estimated ? input.weightKg : null, met, calories, estimated ? null : input.source],
      type: QueryTypes.INSERT,
    });
    const [created] = await this.db.query<CardioRow>(`SELECT ${columns} FROM cardio_sessions WHERE id=? AND user_id=?`, { replacements: [id, userId], type: QueryTypes.SELECT });
    return mapCardio(created);
  }

  async delete(userId: string, id: string) {
    return this.db.transaction(async transaction => {
      const [owned] = await this.db.query<{ id: string }>('SELECT id FROM cardio_sessions WHERE id=? AND user_id=? FOR UPDATE', { replacements: [id, userId], type: QueryTypes.SELECT, transaction });
      if (!owned) return false;
      await this.db.query('DELETE FROM cardio_sessions WHERE id=? AND user_id=?', { replacements: [id, userId], type: QueryTypes.DELETE, transaction });
      return true;
    });
  }
}
