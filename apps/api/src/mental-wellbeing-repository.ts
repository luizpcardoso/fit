import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize } from 'sequelize';
import {
  mentalCheckInInputSchema,
  type MentalCheckIn,
  type MentalCheckInInput,
  type MentalEmotion,
  type MentalFactor,
} from '@fit/contracts';

type CheckInRow = {
  id: string;
  check_in_date: string | Date;
  check_in_time: string;
  mood: MentalCheckIn['mood'];
  emotions_json: string;
  factors_json: string;
  note: string | null;
  created_at: Date;
  updated_at: Date;
};

const columns = 'id,check_in_date,check_in_time,mood,emotions_json,factors_json,note,created_at,updated_at';
const dateOnly = (value: string | Date) => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
const parseList = <T extends string>(value: string, allowed: readonly T[]): T[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T)) : [];
  } catch { return []; }
};
const emotions = mentalCheckInInputSchema.shape.emotions.element.options;
const factors = mentalCheckInInputSchema.shape.factors.element.options;
const mapCheckIn = (row: CheckInRow): MentalCheckIn => ({
  id: row.id,
  date: dateOnly(row.check_in_date),
  time: row.check_in_time.slice(0, 5),
  mood: row.mood,
  emotions: parseList<MentalEmotion>(row.emotions_json, emotions),
  factors: parseList<MentalFactor>(row.factors_json, factors),
  note: row.note,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export interface MentalWellbeingStore {
  list(userId: string, from: string, to: string): Promise<MentalCheckIn[]>;
  create(userId: string, input: MentalCheckInInput): Promise<MentalCheckIn>;
  update(userId: string, id: string, input: MentalCheckInInput): Promise<MentalCheckIn | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export class MentalWellbeingRepository implements MentalWellbeingStore {
  constructor(private db: Sequelize) {}

  private async find(userId: string, id: string) {
    const [row] = await this.db.query<CheckInRow>(`SELECT ${columns} FROM mental_check_ins WHERE id=? AND user_id=?`, { replacements:[id,userId],type:QueryTypes.SELECT });
    return row ? mapCheckIn(row) : null;
  }

  async list(userId: string, from: string, to: string) {
    const rows = await this.db.query<CheckInRow>(`SELECT ${columns} FROM mental_check_ins WHERE user_id=? AND check_in_date BETWEEN ? AND ? ORDER BY check_in_date DESC,check_in_time DESC,id DESC LIMIT 100`, { replacements:[userId,from,to],type:QueryTypes.SELECT });
    return rows.map(mapCheckIn);
  }

  async create(userId: string, input: MentalCheckInInput) {
    const id = randomUUID();
    await this.db.query('INSERT INTO mental_check_ins (id,user_id,check_in_date,check_in_time,mood,emotions_json,factors_json,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE check_in_time=VALUES(check_in_time),mood=VALUES(mood),emotions_json=VALUES(emotions_json),factors_json=VALUES(factors_json),note=VALUES(note),updated_at=UTC_TIMESTAMP()', {
      replacements:[id,userId,input.date,input.time,input.mood,JSON.stringify(input.emotions),JSON.stringify(input.factors),input.note??null],
      type:QueryTypes.INSERT,
    });
    const [saved] = await this.list(userId,input.date,input.date);
    return saved;
  }

  async update(userId: string, id: string, input: MentalCheckInInput) {
    return this.db.transaction(async transaction => {
      const [owned] = await this.db.query<{id:string}>('SELECT id FROM mental_check_ins WHERE id=? AND user_id=? FOR UPDATE', { replacements:[id,userId],type:QueryTypes.SELECT,transaction });
      if (!owned) return null;
      await this.db.query('UPDATE mental_check_ins SET check_in_date=?,check_in_time=?,mood=?,emotions_json=?,factors_json=?,note=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?', { replacements:[input.date,input.time,input.mood,JSON.stringify(input.emotions),JSON.stringify(input.factors),input.note??null,id,userId],type:QueryTypes.UPDATE,transaction });
      const [row] = await this.db.query<CheckInRow>(`SELECT ${columns} FROM mental_check_ins WHERE id=? AND user_id=?`, { replacements:[id,userId],type:QueryTypes.SELECT,transaction });
      return row ? mapCheckIn(row) : null;
    });
  }

  async delete(userId: string, id: string) {
    return this.db.transaction(async transaction => {
      const [owned] = await this.db.query<{id:string}>('SELECT id FROM mental_check_ins WHERE id=? AND user_id=? FOR UPDATE', { replacements:[id,userId],type:QueryTypes.SELECT,transaction });
      if (!owned) return false;
      await this.db.query('DELETE FROM mental_check_ins WHERE id=? AND user_id=?', { replacements:[id,userId],type:QueryTypes.DELETE,transaction });
      return true;
    });
  }
}
