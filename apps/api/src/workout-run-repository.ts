import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize } from 'sequelize';
import { isWorkoutRunOpen, type SaveWorkoutRunInput, type WorkoutRun, type WorkoutRunPrevious } from '@fit/contracts';
import type { WorkoutRepository } from './workout-repository.js';

type Row = { id: string; snapshot: string | Omit<WorkoutRun, 'id' | 'progress' | 'version' | 'historySessionId'>; progress: string | WorkoutRun['progress']; version: number; mutation_id: string; history_session_id: string | null };
const parse = <T>(value: string | T): T => typeof value === 'string' ? JSON.parse(value) : value;
const hydrate = (row: Row): WorkoutRun => ({ ...parse(row.snapshot), id: row.id, progress: parse(row.progress), version: row.version, historySessionId: row.history_session_id });
export type SaveRunResult = { kind: 'ok'; run: WorkoutRun } | { kind: 'conflict'; run: WorkoutRun } | { kind: 'invalid' } | { kind: 'not_found' };
export class WorkoutRunRepository {
  constructor(private db: Sequelize, private workouts: WorkoutRepository) {}
  async active(userId: string): Promise<WorkoutRun | null> {
    const [row] = await this.db.query<Row>("SELECT * FROM workout_runs WHERE user_id=? AND status IN ('running','paused') LIMIT 1", { replacements: [userId], type: QueryTypes.SELECT });
    return row ? hydrate(row) : null;
  }
  async get(userId: string, id: string) {
    const [row] = await this.db.query<Row>('SELECT * FROM workout_runs WHERE id=? AND user_id=?', { replacements: [id, userId], type: QueryTypes.SELECT });
    return row ? hydrate(row) : null;
  }
  /**
   * Values lifted the last time each exercise of this division was done, newest finished run first.
   * Only the owner's completed runs are read; exercises never recorded are simply absent.
   */
  async previous(userId: string, divisionId: string): Promise<WorkoutRunPrevious> {
    const rows = await this.db.query<Pick<Row, 'progress'>>("SELECT progress FROM workout_runs WHERE user_id=? AND status='completed' AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.divisionId'))=? ORDER BY updated_at DESC LIMIT 10", { replacements: [userId, divisionId], type: QueryTypes.SELECT });
    const result: WorkoutRunPrevious = {};
    for (const row of rows) for (const exercise of parse(row.progress).exercises) {
      const performed = (exercise.performed ?? []).filter(entry => exercise.completedSets.includes(entry.set) && (entry.reps !== null || entry.loadKg !== null));
      if (!result[exercise.id] && performed.length) result[exercise.id] = performed;
    }
    return result;
  }
  async save(userId: string, id: string, input: SaveWorkoutRunInput): Promise<SaveRunResult> {
    return this.db.transaction(async transaction => {
      // All run mutations for one owner share this lock, including the first offline sync.
      await this.db.query('SELECT id FROM users WHERE id=? FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      const [row] = await this.db.query<Row>('SELECT * FROM workout_runs WHERE id=? AND user_id=? FOR UPDATE', { replacements: [id, userId], type: QueryTypes.SELECT, transaction });
      if (row?.mutation_id === input.mutationId) return { kind: 'ok', run: hydrate(row) };
      if (row && (row.version !== input.version || !isWorkoutRunOpen(hydrate(row).progress))) return { kind: 'conflict', run: hydrate(row) };
      if (!row && input.version !== 0) return { kind: 'not_found' };
      let snapshot: Row['snapshot'];
      if (row) snapshot = parse(row.snapshot);
      else {
        const [collision] = await this.db.query<Row>('SELECT * FROM workout_runs WHERE id=?', { replacements: [id], type: QueryTypes.SELECT, transaction });
        if (collision) return { kind: 'not_found' };
        const [active] = await this.db.query<Row>("SELECT * FROM workout_runs WHERE user_id=? AND status IN ('running','paused') LIMIT 1", { replacements: [userId], type: QueryTypes.SELECT, transaction });
        if (active) return { kind: 'conflict', run: hydrate(active) };
        const plan = await this.workouts.getPlan(userId, input.planId);
        const division = plan?.divisions.find(item => item.id === input.divisionId);
        if (!plan || !division || plan.status !== 'available') return { kind: 'not_found' };
        snapshot = { planId: plan.id, divisionId: division.id, planName: plan.name, divisionName: division.name, divisionLabel: division.label, exercises: division.exercises };
      }
      const s = parse(snapshot), p = input.progress;
      if (input.planId !== s.planId || input.divisionId !== s.divisionId || p.currentIndex >= s.exercises.length || p.exercises.length !== s.exercises.length || new Set(p.exercises.map(e => e.id)).size !== p.exercises.length) return { kind: 'invalid' };
      if (p.exercises.some(e => { const prescription = s.exercises.find(x => x.id === e.id); return !prescription || new Set(e.completedSets).size !== e.completedSets.length || e.completedSets.some(n => n >= prescription.sets) || (e.skipped && e.completedSets.length > 0) || (e.performed ?? []).some(entry => entry.set >= prescription.sets) || new Set((e.performed ?? []).map(entry => entry.set)).size !== (e.performed ?? []).length; })) return { kind: 'invalid' };
      if ((p.status === 'paused') !== (p.pausedAt !== null) || (p.status === 'paused' && p.restEndsAt !== null) || (p.status === 'running' && p.restRemainingMs !== null) || (isWorkoutRunOpen(p) ? p.finishedAt !== null : p.finishedAt === null)) return { kind: 'invalid' };
      if (p.startedAt > Date.now() + 300_000 || (p.finishedAt !== null && p.finishedAt < p.startedAt) || (row && p.startedAt !== hydrate(row).progress.startedAt)) return { kind: 'invalid' };
      const now = Date.now(), end = p.finishedAt ?? p.pausedAt ?? now;
      if (end > now + 300_000 || end < p.startedAt || p.pausedMs > Math.max(0, end - p.startedAt) || (p.restEndsAt !== null && p.restEndsAt > now + 3_900_000) || (!isWorkoutRunOpen(p) && (p.restEndsAt !== null || p.restRemainingMs !== null))) return { kind: 'invalid' };
      let historySessionId = row?.history_session_id ?? null;
      if (p.status === 'completed') {
        if (!p.exercises.some(e => e.completedSets.length > 0)) return { kind: 'invalid' };
        historySessionId = randomUUID();
        const performedIds = p.exercises.filter(e => e.completedSets.length > 0).map(e => e.id);
        // The run retains exact series; the legacy history stores exercises with any activity.
        const [links] = await this.db.query<{ id: string; plan_id: string }>('SELECT d.id,d.plan_id FROM workout_divisions d JOIN workout_plans p ON p.id=d.plan_id WHERE d.id=? AND p.user_id=?', { replacements: [s.divisionId, userId], type: QueryTypes.SELECT, transaction });
        await this.db.query("INSERT INTO workout_sessions (id,user_id,plan_id,division_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'completed','detailed',?,NOW(),NOW())", { replacements: [historySessionId, userId, links?.plan_id ?? null, links?.id ?? null, s.planName, s.divisionName, s.divisionLabel, p.performedOn, JSON.stringify(performedIds)], transaction });
      }
      const version = (row?.version ?? 0) + 1;
      if (row) await this.db.query('UPDATE workout_runs SET progress=?,status=?,version=?,mutation_id=?,history_session_id=?,updated_at=NOW() WHERE id=? AND user_id=?', { replacements: [JSON.stringify(p), p.status, version, input.mutationId, historySessionId, id, userId], transaction });
      else await this.db.query('INSERT INTO workout_runs (id,user_id,snapshot,progress,status,version,mutation_id,history_session_id,updated_at) VALUES (?,?,?,?,?,?,?,?,NOW())', { replacements: [id, userId, JSON.stringify(s), JSON.stringify(p), p.status, version, input.mutationId, historySessionId], transaction });
      return { kind: 'ok', run: { ...s, id, progress: p, version, historySessionId } };
    });
  }
}
