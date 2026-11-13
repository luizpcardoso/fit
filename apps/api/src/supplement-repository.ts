import { pageWindow, type HealthPageQuery, type Page, type HealthOccasionalDay, type OccasionalIntakeInput } from '@fit/contracts';
import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';
import { weekdayFromDate } from './weekday.js';
import { supplementInputSchema, type HealthKind, type Supplement, type SupplementInput, type SupplementToday, type UpdateSupplementInput } from '@fit/contracts';

type Row = { id: string; usage_mode: 'recurring' | 'occasional'; illustration: Supplement['illustration']; name: string; amount: string | null; unit: Supplement['unit']; strength: string | null; daily_frequency: number; times: string[] | string; weekdays_json: string | null; remind: number; notes: string | null; active: number; created_at: Date; updated_at: Date };
const columns = 'id,usage_mode,illustration,name,amount,unit,strength,daily_frequency,times,weekdays_json,remind,notes,active,created_at,updated_at';
const parseWeekdays = (value: string | null) => { if (!value) return null; try { const days = JSON.parse(value); return Array.isArray(days) && days.length ? days.map(Number) : null; } catch { return null; } };
const map = (row: Row): Supplement => ({ id: row.id, usageMode: row.usage_mode ?? 'recurring', illustration: row.illustration ?? null, name: row.name, amount: row.amount === null ? null : Number(row.amount), unit: row.unit, strength: row.strength, dailyFrequency: row.daily_frequency, times: Array.isArray(row.times) ? row.times : JSON.parse(row.times), weekdays: parseWeekdays(row.weekdays_json), remind: Boolean(row.remind), notes: row.notes, active: Boolean(row.active), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });

const serializeWeekdays = (days: number[] | null | undefined) => days?.length && days.length < 7 ? JSON.stringify([...days].sort((a, b) => a - b)) : null;

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
    await this.db.query('INSERT INTO supplements (id,user_id,kind,usage_mode,illustration,name,amount,unit,strength,daily_frequency,times,weekdays_json,remind,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())', { replacements: [id, userId, this.kind, input.usageMode ?? 'recurring', input.illustration ?? null, input.name, input.amount ?? null, input.unit ?? null, input.strength ?? null, input.dailyFrequency, JSON.stringify(input.times), serializeWeekdays(input.weekdays), input.remind ?? true, input.notes ?? null], type: QueryTypes.INSERT });
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
        supplementInputSchema.parse({ name: next.name, amount: next.amount, unit: next.unit, strength: next.strength, dailyFrequency: next.dailyFrequency, times: next.times, weekdays: next.weekdays, notes: next.notes });
      }
      await this.db.query('UPDATE supplements SET usage_mode=?,illustration=?,name=?,amount=?,unit=?,strength=?,daily_frequency=?,times=?,weekdays_json=?,remind=?,notes=?,active=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND kind=?', { replacements: [next.usageMode ?? 'recurring', next.illustration ?? null, next.name, next.amount ?? null, next.unit ?? null, next.strength ?? null, next.dailyFrequency, JSON.stringify(next.times), serializeWeekdays(next.weekdays), next.remind, next.notes ?? null, next.active, id, userId, this.kind], type: QueryTypes.UPDATE, transaction });
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
    const weekday = weekdayFromDate(date);
    const supplements = (await this.list(userId)).filter(item => item.active && item.usageMode !== 'occasional' && (!item.weekdays || item.weekdays.includes(weekday)));
    const [intakes, dismissals] = await Promise.all([
      this.db.query<{ supplement_id: string; slot: number; consumed_at: Date }>('SELECT i.supplement_id,i.slot,i.consumed_at FROM supplement_intakes i JOIN supplements s ON s.id=i.supplement_id WHERE i.user_id=? AND s.user_id=? AND s.kind=? AND i.intake_date=?', { replacements: [userId, userId, this.kind, date], type: QueryTypes.SELECT }),
      this.db.query<{ supplement_id: string; slot: number; dismissed_at: Date }>('SELECT d.supplement_id,d.slot,d.dismissed_at FROM supplement_dismissals d JOIN supplements s ON s.id=d.supplement_id WHERE d.user_id=? AND s.user_id=? AND s.kind=? AND d.activity_date=?', { replacements: [userId, userId, this.kind, date], type: QueryTypes.SELECT }),
    ]);
    const items = supplements.flatMap(supplement => Array.from({ length: supplement.dailyFrequency }, (_, slot) => {
      const intake = intakes.find(item => item.supplement_id === supplement.id && item.slot === slot);
      const dismissal = dismissals.find(item => item.supplement_id === supplement.id && item.slot === slot);
      return { supplement, slot, time: supplement.times[slot] ?? null, consumedAt: intake ? new Date(intake.consumed_at).toISOString() : null, dismissedAt: dismissal ? new Date(dismissal.dismissed_at).toISOString() : null };
    }));
    const counted = items.filter(item => !item.dismissedAt);
    const consumed = counted.filter(item => item.consumedAt).length;
    return { date, total: counted.length, consumed, remaining: counted.length - consumed, dismissed: items.length - counted.length, items };
  }

  async occasionalDay(userId: string, date: string): Promise<HealthOccasionalDay> {
    const allItems = await this.list(userId);
    const items = allItems.filter(item => item.active && item.usageMode === 'occasional');
    // Keep recorded events visible after a pause or mode change, without making the item registerable.
    const intakes = await this.db.query<{ id: string; itemId: string; date: string; time: string }>(
      `SELECT i.id,i.supplement_id AS itemId,i.intake_date AS date,i.intake_time AS time
       FROM supplement_occasional_intakes i JOIN supplements s ON s.id=i.supplement_id
       WHERE i.user_id=? AND s.user_id=? AND s.kind=? AND s.deleted_at IS NULL AND i.canceled_at IS NULL AND i.intake_date=?
       ORDER BY i.intake_time,i.id`, { replacements: [userId, userId, this.kind, date], type: QueryTypes.SELECT });
    const recordedIds = new Set(intakes.map(intake => intake.itemId));
    const recordedItems = allItems.filter(item => recordedIds.has(item.id) && !items.some(active => active.id === item.id));
    return { date, items: [...items, ...recordedItems], intakes, count: intakes.length };
  }

  async consumeOccasional(userId: string, id: string, input: OccasionalIntakeInput) {
    return this.db.transaction(async transaction => {
      const item = await this.owned(userId, id, transaction);
      if (!item?.active || item.usageMode !== 'occasional') return false;
      const [existing] = await this.db.query<{ id: string; intake_date: string; intake_time: string }>(
        'SELECT id,intake_date,intake_time FROM supplement_occasional_intakes WHERE supplement_id=? AND operation_id=?',
        { replacements: [id, input.operationId], type: QueryTypes.SELECT, transaction });
      if (existing) return existing.intake_date === input.date && existing.intake_time === input.time;
      await this.db.query(`INSERT INTO supplement_occasional_intakes
        (id,user_id,supplement_id,operation_id,intake_date,intake_time) VALUES (?,?,?,?,?,?)`,
        { replacements: [randomUUID(), userId, id, input.operationId, input.date, input.time], type: QueryTypes.INSERT, transaction });
      return true;
    });
  }

  async undoOccasional(userId: string, id: string, intakeId: string) {
    return this.db.transaction(async transaction => {
      if (!await this.owned(userId, id, transaction)) return false;
      await this.db.query('UPDATE supplement_occasional_intakes SET canceled_at=COALESCE(canceled_at,UTC_TIMESTAMP()) WHERE id=? AND supplement_id=? AND user_id=?',
        { replacements: [intakeId, id, userId], type: QueryTypes.DELETE, transaction });
      return true;
    });
  }

  async dismiss(userId: string, id: string, date: string, slot: number) {
    return this.db.transaction(async transaction => {
      const item = await this.owned(userId, id, transaction);
      if (!item?.active || item.usageMode === 'occasional' || slot >= item.dailyFrequency) return false;
      await this.db.query('INSERT INTO supplement_dismissals (id,user_id,supplement_id,activity_date,slot,dismissed_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id', { replacements: [randomUUID(), userId, id, date, slot], type: QueryTypes.INSERT, transaction });
      return true;
    });
  }

  async restore(userId: string, id: string, date: string, slot: number) {
    return this.db.transaction(async transaction => {
      if (!await this.owned(userId, id, transaction)) return false;
      await this.db.query('DELETE FROM supplement_dismissals WHERE user_id=? AND supplement_id=? AND activity_date=? AND slot=?', { replacements: [userId, id, date, slot], type: QueryTypes.DELETE, transaction });
      return true;
    });
  }

  async consume(userId: string, id: string, date: string, slot: number) {
    return this.db.transaction(async transaction => {
      const item = await this.owned(userId, id, transaction);
      if (!item?.active || item.usageMode === 'occasional' || slot >= item.dailyFrequency) return false;
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
