import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import type {
  Injectable,
  InjectableApplication,
  InjectableEstimate,
  InjectableInput,
  InjectableToday,
  InjectableUnit,
  UpdateInjectableInput,
} from "@fit/contracts";

type InjectableRow = {
  id: string;
  name: string;
  dose: string;
  unit: InjectableUnit;
  custom_unit: string | null;
  weekdays_json: string;
  half_life_days: string | null;
  notes: string | null;
  active: number;
  created_at: Date;
  updated_at: Date;
};
type ApplicationRow = {
  id: string;
  injectable_id: string;
  application_date: string | Date;
  dose: string;
  unit: InjectableUnit;
  custom_unit: string | null;
  applied_at: Date;
};
const itemColumns =
  "id,name,dose,unit,custom_unit,weekdays_json,half_life_days,notes,active,created_at,updated_at";
const applicationColumns =
  "id,injectable_id,application_date,dose,unit,custom_unit,applied_at";
const dateOnly = (value: string | Date) =>
  typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const parseWeekdays = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      : [];
  } catch {
    return [];
  }
};
const mapItem = (row: InjectableRow): Injectable => ({
  id: row.id,
  name: row.name,
  dose: Number(row.dose),
  unit: row.unit,
  customUnit: row.custom_unit,
  weekdays: parseWeekdays(row.weekdays_json),
  halfLifeDays: row.half_life_days === null ? null : Number(row.half_life_days),
  notes: row.notes,
  active: Boolean(row.active),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});
const mapApplication = (row: ApplicationRow): InjectableApplication => ({
  id: row.id,
  injectableId: row.injectable_id,
  date: dateOnly(row.application_date),
  dose: Number(row.dose),
  unit: row.unit,
  customUnit: row.custom_unit,
  appliedAt: new Date(row.applied_at).toISOString(),
});
const weekdayFromDate = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

export function estimateRemaining(
  dose: number,
  appliedAt: Date,
  at: Date,
  halfLifeDays: number,
) {
  const elapsed = Math.max(0, at.getTime() - appliedAt.getTime());
  return dose * Math.pow(0.5, elapsed / (halfLifeDays * 86_400_000));
}

export interface InjectableStore {
  list(userId: string): Promise<Injectable[]>;
  create(userId: string, input: InjectableInput): Promise<string>;
  update(
    userId: string,
    id: string,
    input: UpdateInjectableInput,
  ): Promise<boolean>;
  delete(userId: string, id: string): Promise<boolean>;
  today(userId: string, date: string): Promise<InjectableToday>;
  apply(userId: string, id: string, date: string): Promise<boolean>;
  undo(userId: string, id: string, date: string): Promise<boolean>;
  estimate(
    userId: string,
    id: string,
    days: number,
  ): Promise<InjectableEstimate | null>;
}

export class InjectableRepository implements InjectableStore {
  constructor(private db: Sequelize) {}
  async list(userId: string) {
    const rows = await this.db.query<InjectableRow>(
      `SELECT ${itemColumns} FROM injectables WHERE user_id=? ORDER BY active DESC,name,id`,
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map(mapItem);
  }
  async create(userId: string, input: InjectableInput) {
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO injectables (id,user_id,name,dose,unit,custom_unit,weekdays_json,half_life_days,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
      {
        replacements: [
          id,
          userId,
          input.name,
          input.dose,
          input.unit,
          input.customUnit ?? null,
          JSON.stringify([...input.weekdays].sort()),
          input.halfLifeDays ?? null,
          input.notes ?? null,
        ],
        type: QueryTypes.INSERT,
      },
    );
    return id;
  }
  private async owned(userId: string, id: string, transaction?: Transaction) {
    const [row] = await this.db.query<InjectableRow>(
      `SELECT ${itemColumns} FROM injectables WHERE id=? AND user_id=?${transaction ? " FOR UPDATE" : ""}`,
      { replacements: [id, userId], type: QueryTypes.SELECT, transaction },
    );
    return row ? mapItem(row) : null;
  }
  async update(userId: string, id: string, input: UpdateInjectableInput) {
    const [, count] = await this.db.query(
      "UPDATE injectables SET name=?,dose=?,unit=?,custom_unit=?,weekdays_json=?,half_life_days=?,notes=?,active=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?",
      {
        replacements: [
          input.name,
          input.dose,
          input.unit,
          input.customUnit ?? null,
          JSON.stringify([...input.weekdays].sort()),
          input.halfLifeDays ?? null,
          input.notes ?? null,
          input.active,
          id,
          userId,
        ],
        type: QueryTypes.UPDATE,
      },
    );
    return Number(count) > 0;
  }
  async delete(userId: string, id: string) {
    return this.db.transaction(async (transaction) => {
      const item = await this.owned(userId, id, transaction);
      if (!item) return false;
      await this.db.query("DELETE FROM injectables WHERE id=? AND user_id=?", {
        replacements: [id, userId],
        type: QueryTypes.DELETE,
        transaction,
      });
      return true;
    });
  }
  private async applications(userId: string, injectableId: string) {
    const rows = await this.db.query<ApplicationRow>(
      `SELECT ${applicationColumns} FROM injectable_applications WHERE user_id=? AND injectable_id=? ORDER BY applied_at DESC,id DESC LIMIT 1000`,
      { replacements: [userId, injectableId], type: QueryTypes.SELECT },
    );
    return rows.map(mapApplication);
  }
  async today(userId: string, date: string) {
    const weekday = weekdayFromDate(date);
    const items = (await this.list(userId)).filter(
      (item) => item.active && item.weekdays.includes(weekday),
    );
    if (!items.length)
      return { date, total: 0, applied: 0, remaining: 0, items: [] };
    const rows = await this.db.query<ApplicationRow>(
      `SELECT ${applicationColumns} FROM injectable_applications WHERE user_id=? AND application_date=? AND injectable_id IN (?)`,
      {
        replacements: [userId, date, items.map((item) => item.id)],
        type: QueryTypes.SELECT,
      },
    );
    const byId = new Map(
      rows.map((row) => [row.injectable_id, mapApplication(row)]),
    );
    const result = items.map((injectable) => ({
      injectable,
      application: byId.get(injectable.id) ?? null,
    }));
    const applied = result.filter((entry) => entry.application).length;
    return {
      date,
      total: result.length,
      applied,
      remaining: result.length - applied,
      items: result,
    };
  }
  async apply(userId: string, id: string, date: string) {
    return this.db.transaction(async (transaction) => {
      const item = await this.owned(userId, id, transaction);
      if (!item?.active || !item.weekdays.includes(weekdayFromDate(date)))
        return false;
      await this.db.query(
        "INSERT INTO injectable_applications (id,user_id,injectable_id,application_date,dose,unit,custom_unit,applied_at,created_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id",
        {
          replacements: [
            randomUUID(),
            userId,
            id,
            date,
            item.dose,
            item.unit,
            item.customUnit ?? null,
          ],
          type: QueryTypes.INSERT,
          transaction,
        },
      );
      return true;
    });
  }
  async undo(userId: string, id: string, date: string) {
    return this.db.transaction(async (transaction) => {
      if (!(await this.owned(userId, id, transaction))) return false;
      await this.db.query(
        "DELETE FROM injectable_applications WHERE user_id=? AND injectable_id=? AND application_date=?",
        {
          replacements: [userId, id, date],
          type: QueryTypes.DELETE,
          transaction,
        },
      );
      return true;
    });
  }
  async estimate(
    userId: string,
    id: string,
    days: number,
  ): Promise<InjectableEstimate | null> {
    const item = await this.owned(userId, id);
    if (!item || !item.halfLifeDays) return null;
    const halfLifeDays = item.halfLifeDays;
    const all = await this.applications(userId, id);
    const compatible = all.filter(
      (application) =>
        application.unit === item.unit &&
        (application.customUnit ?? null) === (item.customUnit ?? null),
    );
    const excludedApplications = all.length - compatible.length;
    const asOf = new Date();
    const amountAt = (at: Date) =>
      round3(
        compatible
          .filter((application) => new Date(application.appliedAt) <= at)
          .reduce(
            (total, application) =>
              total +
              estimateRemaining(
                application.dose,
                new Date(application.appliedAt),
                at,
                halfLifeDays,
              ),
            0,
          ),
      );
    const points = Array.from({ length: days * 2 + 1 }, (_, index) => {
      const at = new Date(asOf.getTime() - (days * 2 - index) * 43_200_000);
      return { at: at.toISOString(), amount: amountAt(at) };
    });
    return {
      injectableId: id,
      asOf: asOf.toISOString(),
      halfLifeDays,
      unit: item.unit,
      customUnit: item.customUnit ?? null,
      estimatedAmount: amountAt(asOf),
      excludedApplications,
      points,
      applications: all.slice(0, 50),
    };
  }
}
