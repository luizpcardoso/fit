import { pageWindow, type HealthPageQuery, type Page } from '@fit/contracts';
import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';
import { supplementInputSchema, type HealthKind, type Supplement, type SupplementInput, type SupplementToday, type UpdateSupplementInput } from '@fit/contracts';

type Row = { id: string; name: string; amount: string | null; unit: Supplement['unit']; strength: string | null; daily_frequency: number; times: string[] | string; notes: string | null; active: number; created_at: Date; updated_at: Date };
const columns = 'id,name,amount,unit,strength,daily_frequency,times,notes,active,created_at,updated_at';
const map = (row: Row): Supplement => ({ id: row.id, name: row.name, amount: row.amount === null ? null : Number(row.amount), unit: row.unit, strength: row.strength, dailyFrequency: row.daily_frequency, times: Array.isArray(row.times) ? row.times : JSON.parse(row.times), notes: row.notes, active: Boolean(row.active), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });

// Type is fixed by the server route, never by a user-supplied owner/type field.
export class SupplementRepository {
  constructor(private db: Sequelize, readonly kind: HealthKind = 'supplement') {}

  async list(userId: string): Promise<Supplement[]> {
    const rows = await this.db.query<Row>(`SELECT ${columns} FROM supplements WHERE user_id=? AND kind=? AND deleted_at IS NULL ORDER BY active DESC,name,id`, { replacements: [userId, this.kind], type: QueryTypes.SELECT });
    return rows.map(map);
  }

  async page(userId: string, query: HealthPageQuery): Promise<Page<Supplement>> {
    return this.db.transaction(async transaction => {
      const where = "user_id=? AND kind=? AND deleted_at IS NULL AND LOCATE(?,name)>0" + (query.status === 'all' ? '' : ' AND active=?');
      const replacements = [userId, this.kind, query.search, ...(query.status === 'all' ? [] : [query.status === 'active'])];
      const [count] = await this.db.query<{ total: number }>(`SELECT COUNT(*) total FROM supplements WHERE ${where}`, { replacements, type: QueryTypes.SELECT, transaction });
      const { offset, ...page } = pageWindow(Number(count.total), query);
      const rows = await this.db.query<Row>(`SELECT ${columns} FROM supplements WHERE ${where} ORDER BY active DESC,name,id LIMIT ? OFFSET ?`, { replacements: [...replacements, page.pageSize, offset], type: QueryTypes.SELECT, transaction });
      return { ...page, items: rows.map(map) };
    });
  }

  async create(userId: string, input: SupplementInput) {
    const id = randomUUID();
    await this.db.query('INSERT INTO supplements (id,user_id,kind,name,amount,unit,strength,daily_frequency,times,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())', { replacements: [id, userId, this.kind, input.name, input.amount ?? null, input.unit ?? null, input.strength ?? null, input.dailyFrequency, JSON.stringify(input.times), input.notes ?? null], type: QueryTypes.INSERT });
    return id;
  }

  private async owned(userId: string, id: string, transaction: Transaction) {
    const [row] = await this.db.query<Row>(`SELECT ${columns} FROM supplements WHERE id=? AND user_id=? AND kind=? AND deleted_at IS NULL FOR UPDATE`, { replacements: [id, userId, this.kind], type: QueryTypes.SELECT, transaction });
    return row ? map(row) : null;
  }

  async update(userId: string, id: string, input: UpdateSupplementInput) {
    return this.db.transaction(async transaction => {
      const current = await this.owned(userId, id, transaction);
      if (!current) return false;
      const next = { ...current, ...input };
      // Validate merged schedules too: PATCH of frequency alone must not silently lose slots.
      // Legacy optional schedules are preserved by pause/name-only changes.
      if (input.times !== undefined || input.dailyFrequency !== undefined) {
        supplementInputSchema.parse({ name: next.name, amount: next.amount, unit: next.unit, strength: next.strength, dailyFrequency: next.dailyFrequency, times: next.times, notes: next.notes });
      }
      await this.db.query('UPDATE supplements SET name=?,amount=?,unit=?,strength=?,daily_frequency=?,times=?,notes=?,active=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND kind=?', { replacements: [next.name, next.amount ?? null, next.unit ?? null, next.strength ?? null, next.dailyFrequency, JSON.stringify(next.times), next.notes ?? null, next.active, id, userId, this.kind], type: QueryTypes.UPDATE, transaction });
      return true;
    });
  }

  async delete(userId: string, id: string) {
    return this.db.transaction(async transaction => {
      if (!await this.owned(userId, id, transaction)) return false;
      await this.db.query('UPDATE supplements SET deleted_at=UTC_TIMESTAMP(),active=0,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND kind=?', { replacements: [id, userId, this.kind], type: QueryTypes.UPDATE, transaction });
      return true;
    });
  }

  async today(userId: string, date: string): Promise<SupplementToday> {
    const supplements = (await this.list(userId)).filter(item => item.active);
    const intakes = await this.db.query<{ supplement_id: string; slot: number; consumed_at: Date }>('SELECT i.supplement_id,i.slot,i.consumed_at FROM supplement_intakes i JOIN supplements s ON s.id=i.supplement_id WHERE i.user_id=? AND s.user_id=? AND s.kind=? AND i.intake_date=?', { replacements: [userId, userId, this.kind, date], type: QueryTypes.SELECT });
    const items = supplements.flatMap(supplement => Array.from({ length: supplement.dailyFrequency }, (_, slot) => {
      const intake = intakes.find(item => item.supplement_id === supplement.id && item.slot === slot);
      return { supplement, slot, time: supplement.times[slot] ?? null, consumedAt: intake ? new Date(intake.consumed_at).toISOString() : null };
    }));
    const consumed = items.filter(item => item.consumedAt).length;
    return { date, total: items.length, consumed, remaining: items.length - consumed, items };
  }

  async consume(userId: string, id: string, date: string, slot: number) {
    return this.db.transaction(async transaction => {
      const item = await this.owned(userId, id, transaction);
      if (!item?.active || slot >= item.dailyFrequency) return false;
      await this.db.query('INSERT INTO supplement_intakes (id,user_id,supplement_id,intake_date,slot,consumed_at,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id', { replacements: [randomUUID(), userId, id, date, slot], type: QueryTypes.INSERT, transaction });
      return true;
    });
  }

  async undo(userId: string, id: string, date: string, slot: number) {
    return this.db.transaction(async transaction => {
      if (!await this.owned(userId, id, transaction)) return false;
      await this.db.query('DELETE FROM supplement_intakes WHERE user_id=? AND supplement_id=? AND intake_date=? AND slot=?', { replacements: [userId, id, date, slot], type: QueryTypes.DELETE, transaction });
      return true;
    });
  }
}
