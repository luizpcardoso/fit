import { planValidity, validityDeadline, validitySqlValue } from './workout-validity.js';
import { randomUUID } from 'node:crypto';
import { QueryTypes, Sequelize, type Transaction } from 'sequelize';
import type { CatalogExercise, CompleteWorkoutInput, CreateWorkoutPlanInput, SuggestedWorkoutPlan, UpdateWorkoutPlanInput, UpdateWorkoutSessionInput, WorkoutGoalInput, WorkoutGoalPlanDay, WorkoutGoalSummary, WorkoutPlan, WorkoutSession } from '@fit/contracts';

type PlanRow = { valid_until: Date | null; id: string; name: string; is_active: number; status: 'available'|'archived'; created_at: Date; updated_at: Date };
type DivisionRow = { id: string; plan_id: string; label: string; name: string; position: number };
type ExerciseRow = { id: string; division_id: string; exercise_id: string|null; exercise_name: string; source: 'catalog'|'custom'; image_url: string|null; position: number; sets: number; reps: string; load_value: string|null; rest_seconds: number|null; notes: string|null };
type SessionRow = { id: string; plan_id: string|null; division_id: string|null; plan_name: string; division_name: string; division_label: string; performed_on: string; status: 'completed'|'cancelled'; completion_mode: 'quick'|'detailed'; completed_exercise_ids: string[]|string; created_at: Date; updated_at: Date };
type GoalRow = { weekly_target: number; mode: 'flexible'|'planned'; schedule: unknown };

const featuredCatalogNames = [
  'Supino reto com barra', 'Supino inclinado com barra', 'Supino reto com halteres', 'Supino máquina',
  'Agachamento livre', 'Agachamento Smith', 'Leg press 45 graus', 'Hack squat', 'Cadeira extensora',
  'Mesa flexora', 'Cadeira flexora', 'Cadeira adutora', 'Cadeira abdutora', 'Levantamento terra romeno',
  'Stiff com barra', 'Hip thrust com barra', 'Panturrilha em pé máquina', 'Puxada frontal aberta',
  'Puxada frontal neutra', 'Remada baixa triangulo', 'Remada curvada com barra', 'Remada unilateral com halter',
  'Desenvolvimento com halteres sentado', 'Elevação lateral com halteres', 'Rosca direta com barra',
  'Rosca alternada com halteres', 'Rosca martelo', 'Tríceps na polia corda', 'Crossover alto para baixo',
  'Abdominal crunch',
] as const;

export class WorkoutRepository {
  constructor(private readonly db: Sequelize) {}
  async listCatalog(search = ''): Promise<CatalogExercise[]> {
    const term = search.trim();
    if (!term) {
      const rows = await this.db.query<CatalogExercise>("SELECT id,name,category,equipment,primary_muscle primaryMuscle,CASE WHEN image_url IS NULL THEN NULL ELSE CONCAT('/media/exercises/',image_url) END imageUrl FROM exercises WHERE source='catalog' AND name IN (:names)", { replacements: { names: featuredCatalogNames }, type: QueryTypes.SELECT });
      const byName = new Map(rows.map((exercise) => [exercise.name, exercise]));
      return featuredCatalogNames.flatMap((name) => {
        const exercise = byName.get(name);
        return exercise ? [exercise] : [];
      });
    }
    return this.db.query<CatalogExercise>("SELECT id,name,category,equipment,primary_muscle primaryMuscle,CASE WHEN image_url IS NULL THEN NULL ELSE CONCAT('/media/exercises/',image_url) END imageUrl FROM exercises WHERE source='catalog' AND name LIKE ? ORDER BY name LIMIT 60", { replacements: [`%${term}%`], type: QueryTypes.SELECT });
  }
  async listSuggestedPlans(): Promise<SuggestedWorkoutPlan[]> {
    const plans=await this.db.query<{id:string;name:string;audience:'female'|'male'|'unisex';goal:string;level:'adaptation'|'beginner'|'intermediate';description:string;reference:string}>('SELECT id,name,audience,goal,level,description,reference FROM suggested_workout_plans ORDER BY level,name',{type:QueryTypes.SELECT});
    const divisions=await this.db.query<{id:string;plan_id:string;name:string;position:number}>('SELECT id,plan_id,name,position FROM suggested_workout_divisions ORDER BY position',{type:QueryTypes.SELECT});
    const exercises=await this.db.query<{id:string;division_id:string;catalogExerciseId:string;name:string;category:CatalogExercise['category'];equipment:string|null;primaryMuscle:string|null;imageUrl:string|null;sets:number;reps:string;rest_seconds:number|null;position:number}>("SELECT swe.id,swe.division_id,e.id catalogExerciseId,e.name,e.category,e.equipment,e.primary_muscle primaryMuscle,CASE WHEN e.image_url IS NULL THEN NULL ELSE CONCAT('/media/exercises/',e.image_url) END imageUrl,swe.sets,swe.reps,swe.rest_seconds,swe.position FROM suggested_workout_exercises swe JOIN exercises e ON e.id=swe.exercise_id ORDER BY swe.position",{type:QueryTypes.SELECT});
    return plans.map(plan=>({...plan,divisions:divisions.filter(division=>division.plan_id===plan.id).map(division=>({id:division.id,name:division.name,position:division.position,exercises:exercises.filter(exercise=>exercise.division_id===division.id).map(exercise=>({id:exercise.id,catalogExerciseId:exercise.catalogExerciseId,name:exercise.name,category:exercise.category,equipment:exercise.equipment,primaryMuscle:exercise.primaryMuscle,imageUrl:exercise.imageUrl,sets:exercise.sets,reps:exercise.reps,restSeconds:exercise.rest_seconds,position:exercise.position}))}))}));
  }
  async createPlan(userId: string, input: CreateWorkoutPlanInput, existingTransaction?: Transaction, allowedExerciseOwnerId = userId): Promise<string | 'limit'> {
    const create = async (transaction: Transaction) => {
      // Serialize creation per owner, including retries whose first response was lost.
      await this.db.query('SELECT id FROM users WHERE id=? FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      if (input.requestId) {
        const existing = await this.db.query<{ id: string }>('SELECT id FROM workout_plans WHERE user_id=? AND request_id=?', { replacements: [userId, input.requestId], type: QueryTypes.SELECT, transaction });
        if (existing.length) return existing[0].id;
      }
      const id = randomUUID();
      const [{ count: availableCount }] = await this.db.query<{count:number}>('SELECT COUNT(*) count FROM workout_plans WHERE user_id=? AND status=\'available\' FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      if (Number(availableCount) >= 3) return 'limit';
      const [{ count: activeCount }] = await this.db.query<{count:number}>('SELECT COUNT(*) count FROM workout_plans WHERE user_id=? AND is_active=1', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      const imageByExercise = await this.exerciseImages(input.divisions.flatMap((division) => division.exercises), userId, allowedExerciseOwnerId, transaction);
      await this.db.query('INSERT INTO workout_plans (id,user_id,request_id,name,is_active,status,valid_until,created_at,updated_at) VALUES (?,?,?,?,?,\'available\',?,NOW(),NOW())', { replacements: [id,userId,input.requestId ?? null,input.name,activeCount === 0,validitySqlValue(validityDeadline(input.validityDays))], type: QueryTypes.INSERT, transaction });
      for (const [divisionIndex, division] of input.divisions.entries()) {
        const divisionId = randomUUID(); const label = String.fromCharCode(65 + divisionIndex);
        await this.db.query('INSERT INTO workout_divisions (id,plan_id,label,name,position,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW())', { replacements: [divisionId,id,label,division.name,divisionIndex], type: QueryTypes.INSERT, transaction });
        for (const [exerciseIndex, exercise] of division.exercises.entries()) await this.insertPlanExercise(userId, divisionId, exercise, exerciseIndex, imageByExercise, transaction);
      }
      return id;
    };
    return existingTransaction ? create(existingTransaction) : this.db.transaction(create);
  }
  async listPlans(userId: string): Promise<WorkoutPlan[]> { const rows = await this.db.query<PlanRow>('SELECT id,name,is_active,status,valid_until,created_at,updated_at FROM workout_plans WHERE user_id=? ORDER BY is_active DESC,updated_at DESC', { replacements:[userId], type:QueryTypes.SELECT }); return Promise.all(rows.map((row)=>this.hydrate(row))); }
  async getPlan(userId: string, id: string): Promise<WorkoutPlan|null> { const rows=await this.db.query<PlanRow>('SELECT id,name,is_active,status,valid_until,created_at,updated_at FROM workout_plans WHERE id=? AND user_id=? LIMIT 1',{replacements:[id,userId],type:QueryTypes.SELECT}); return rows[0]?this.hydrate(rows[0]):null; }
  private async hydrate(row: PlanRow, transaction?: Transaction): Promise<WorkoutPlan> {
    const divisions=await this.db.query<DivisionRow>('SELECT id,plan_id,label,name,position FROM workout_divisions WHERE plan_id=? ORDER BY position',{replacements:[row.id],type:QueryTypes.SELECT,transaction});
    const exercises=await this.db.query<ExerciseRow>('SELECT wpe.* FROM workout_plan_exercises wpe JOIN workout_divisions wd ON wd.id=wpe.division_id WHERE wd.plan_id=? ORDER BY wpe.position',{replacements:[row.id],type:QueryTypes.SELECT,transaction});
    const counts=await this.db.query<{division_id:string;total:number}>('SELECT division_id,COUNT(*) total FROM workout_sessions WHERE plan_id=? AND status=\'completed\' GROUP BY division_id',{replacements:[row.id],type:QueryTypes.SELECT,transaction}); const byDivision=new Map(counts.map(item=>[item.division_id,Number(item.total)])); const completedSessions=counts.reduce((total,item)=>total+Number(item.total),0);
    const [assignment]=await this.db.query<{id:string}>('SELECT id FROM professional_assignments WHERE workout_plan_id=? LIMIT 1',{replacements:[row.id],type:QueryTypes.SELECT,transaction});
    return {...planValidity(row.valid_until),id:row.id,name:row.name,origin:assignment?'professional':'own',isActive:Boolean(row.is_active),status:row.status,completedSessions,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),divisions:divisions.map((d)=>({id:d.id,label:d.label,name:d.name,position:d.position,completedSessions:byDivision.get(d.id)??0,exercises:exercises.filter((e)=>e.division_id===d.id).map((e)=>({id:e.id,name:e.exercise_name,catalogExerciseId:e.exercise_id,source:e.source,imageUrl:e.image_url?`/media/exercises/${e.image_url}`:null,sets:e.sets,reps:e.reps,load:e.load_value===null?null:Number(e.load_value),restSeconds:e.rest_seconds,notes:e.notes}))}))};
  }
  async renew(userId: string, id: string, days: number): Promise<WorkoutPlan | null> {
    return this.db.transaction(async transaction => {
      const [plan] = await this.db.query<PlanRow>('SELECT id,name,is_active,status,valid_until,created_at,updated_at FROM workout_plans WHERE id=? AND user_id=? FOR UPDATE', { replacements: [id, userId], type: QueryTypes.SELECT, transaction });
      if (!plan) return null;
      const now = new Date();
      const deadline = validityDeadline(days, now);
      await this.db.query('UPDATE workout_plans SET valid_until=?,updated_at=? WHERE id=? AND user_id=?', { replacements: [validitySqlValue(deadline), validitySqlValue(now), id, userId], type: QueryTypes.UPDATE, transaction });
      return this.hydrate({ ...plan, valid_until: deadline, updated_at: now });
    });
  }
  /**
   * Edits an own plan in place. Completed sessions keep their snapshot (plan/division names, label,
   * date and completed exercise ids): kept rows are updated by id, renamed exercises get a new row,
   * and removed divisions only detach sessions (FK SET NULL). Professional plans are read-only.
   */
  async updatePlan(userId: string, id: string, input: UpdateWorkoutPlanInput): Promise<WorkoutPlan | 'not_found' | 'professional'> {
    return this.db.transaction(async transaction => {
      const [plan] = await this.db.query<PlanRow>('SELECT id,name,is_active,status,valid_until,created_at,updated_at FROM workout_plans WHERE id=? AND user_id=? FOR UPDATE', { replacements: [id, userId], type: QueryTypes.SELECT, transaction });
      if (!plan) return 'not_found';
      const [assignment] = await this.db.query<{ id: string }>('SELECT id FROM professional_assignments WHERE workout_plan_id=? AND student_id=? LIMIT 1', { replacements: [id, userId], type: QueryTypes.SELECT, transaction });
      if (assignment) return 'professional';
      const now = new Date();
      const validUntil = input.validityDays === undefined ? plan.valid_until : validityDeadline(input.validityDays, now);
      await this.db.query('UPDATE workout_plans SET name=?,valid_until=?,updated_at=? WHERE id=? AND user_id=?', { replacements: [input.name, validitySqlValue(validUntil), validitySqlValue(now), id, userId], type: QueryTypes.UPDATE, transaction });
      const existingDivisions = await this.db.query<{ id: string }>('SELECT id FROM workout_divisions WHERE plan_id=?', { replacements: [id], type: QueryTypes.SELECT, transaction });
      const existingExercises = await this.db.query<{ id: string; exercise_id: string | null; exercise_name: string }>('SELECT wpe.id,wpe.exercise_id,wpe.exercise_name FROM workout_plan_exercises wpe JOIN workout_divisions wd ON wd.id=wpe.division_id WHERE wd.plan_id=?', { replacements: [id], type: QueryTypes.SELECT, transaction });
      const divisionIds = new Set(existingDivisions.map(item => item.id)); const exerciseById = new Map(existingExercises.map(item => [item.id, item]));
      const keptDivisions = new Set<string>(); const keptExercises = new Set<string>();
      const resolved = input.divisions.map(division => ({ ...division, id: division.id && divisionIds.has(division.id) && !keptDivisions.has(division.id) ? (keptDivisions.add(division.id), division.id) : null, exercises: division.exercises.map(exercise => {
        const current = exercise.id ? exerciseById.get(exercise.id) : undefined;
        // A different exercise under the same id would rewrite what old sessions show, so it becomes a new row.
        const keep = current && !keptExercises.has(current.id) && current.exercise_name === exercise.name && (exercise.catalogExerciseId == null || exercise.catalogExerciseId === current.exercise_id);
        if (keep) keptExercises.add(current.id);
        return { ...exercise, id: keep ? current.id : null };
      }) }));
      const removedExercises = existingExercises.map(item => item.id).filter(item => !keptExercises.has(item));
      if (removedExercises.length) await this.db.query('DELETE FROM workout_plan_exercises WHERE id IN (?)', { replacements: [removedExercises], type: QueryTypes.DELETE, transaction });
      const imageByExercise = await this.exerciseImages(resolved.flatMap(division => division.exercises.filter(exercise => !exercise.id)), userId, userId, transaction);
      for (const [divisionIndex, division] of resolved.entries()) {
        const label = String.fromCharCode(65 + divisionIndex); let divisionId = division.id;
        if (divisionId) await this.db.query('UPDATE workout_divisions SET label=?,name=?,position=?,updated_at=NOW() WHERE id=?', { replacements: [label, division.name, divisionIndex, divisionId], type: QueryTypes.UPDATE, transaction });
        else { divisionId = randomUUID(); await this.db.query('INSERT INTO workout_divisions (id,plan_id,label,name,position,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW())', { replacements: [divisionId, id, label, division.name, divisionIndex], type: QueryTypes.INSERT, transaction }); }
        for (const [exerciseIndex, exercise] of division.exercises.entries()) {
          if (exercise.id) await this.db.query('UPDATE workout_plan_exercises SET division_id=?,position=?,sets=?,reps=?,load_value=?,rest_seconds=?,notes=?,updated_at=NOW() WHERE id=?', { replacements: [divisionId, exerciseIndex, exercise.sets, exercise.reps, exercise.load ?? null, exercise.restSeconds ?? null, exercise.notes ?? null, exercise.id], type: QueryTypes.UPDATE, transaction });
          else await this.insertPlanExercise(userId, divisionId, exercise, exerciseIndex, imageByExercise, transaction);
        }
      }
      // Removed last, after kept exercises moved out; sessions keep their snapshot and lose only the link.
      const removedDivisions = [...divisionIds].filter(item => !keptDivisions.has(item));
      if (removedDivisions.length) await this.db.query('DELETE FROM workout_divisions WHERE id IN (?) AND plan_id=?', { replacements: [removedDivisions, id], type: QueryTypes.DELETE, transaction });
      const [updated] = await this.db.query<PlanRow>('SELECT id,name,is_active,status,valid_until,created_at,updated_at FROM workout_plans WHERE id=?', { replacements: [id], type: QueryTypes.SELECT, transaction });
      return this.hydrate(updated, transaction);
    });
  }
  private async exerciseImages(exercises: CreateWorkoutPlanInput['divisions'][number]['exercises'], userId: string, allowedExerciseOwnerId: string, transaction: Transaction) {
    const catalogIds = [...new Set(exercises.map((exercise) => exercise.catalogExerciseId).filter((value): value is string => Boolean(value)))];
    const rows = catalogIds.length
      ? await this.db.query<{ id: string; image_url: string | null }>("SELECT id,image_url FROM exercises WHERE id IN (?) AND (source='catalog' OR owner_user_id IN (?,?))", { replacements: [catalogIds,userId,allowedExerciseOwnerId], type: QueryTypes.SELECT, transaction })
      : [];
    return new Map(rows.map((exercise) => [exercise.id, exercise.image_url]));
  }
  private async insertPlanExercise(userId: string, divisionId: string, exercise: CreateWorkoutPlanInput['divisions'][number]['exercises'][number], exerciseIndex: number, imageByExercise: Map<string, string | null>, transaction: Transaction) {
    let exerciseId = exercise.catalogExerciseId ?? null; const source: 'catalog'|'custom' = exerciseId && imageByExercise.has(exerciseId) ? 'catalog' : 'custom';
    if (exerciseId && !imageByExercise.has(exerciseId)) exerciseId = null;
    if (!exerciseId) { exerciseId = randomUUID(); await this.db.query('INSERT INTO exercises (id,owner_user_id,name,source,created_at,updated_at) VALUES (?,?,?,\'custom\',NOW(),NOW())', { replacements: [exerciseId,userId,exercise.name], type: QueryTypes.INSERT, transaction }); }
    await this.db.query('INSERT INTO workout_plan_exercises (id,division_id,exercise_id,exercise_name,source,image_url,position,sets,reps,load_value,rest_seconds,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())', { replacements: [randomUUID(),divisionId,exerciseId,exercise.name,source,exercise.catalogExerciseId ? imageByExercise.get(exercise.catalogExerciseId) ?? null : null,exerciseIndex,exercise.sets,exercise.reps,exercise.load ?? null,exercise.restSeconds ?? null,exercise.notes ?? null], type: QueryTypes.INSERT, transaction });
  }
  async activate(userId:string,id:string):Promise<boolean>{return this.db.transaction(async t=>{const [owned]=await this.db.query<{id:string}>('SELECT id FROM workout_plans WHERE id=? AND user_id=? AND status=\'available\'',{replacements:[id,userId],type:QueryTypes.SELECT,transaction:t});if(!owned)return false;await this.db.query('UPDATE workout_plans SET is_active=0,updated_at=NOW() WHERE user_id=?',{replacements:[userId],type:QueryTypes.UPDATE,transaction:t});await this.db.query('UPDATE workout_plans SET is_active=1,updated_at=NOW() WHERE id=?',{replacements:[id],type:QueryTypes.UPDATE,transaction:t});return true;});}
  async deactivate(userId:string,id:string):Promise<boolean>{const [plan]=await this.db.query<{id:string}>('SELECT id FROM workout_plans WHERE id=? AND user_id=? AND status=\'available\' LIMIT 1',{replacements:[id,userId],type:QueryTypes.SELECT});if(!plan)return false;await this.db.query('UPDATE workout_plans SET is_active=0,updated_at=NOW() WHERE id=?',{replacements:[id],type:QueryTypes.UPDATE});return true;}
  async setArchived(userId:string,id:string,archived:boolean):Promise<boolean>{return this.db.transaction(async transaction=>{const [plan]=await this.db.query<{id:string}>('SELECT id FROM workout_plans WHERE id=? AND user_id=? FOR UPDATE',{replacements:[id,userId],type:QueryTypes.SELECT,transaction});if(!plan)return false;await this.db.query('UPDATE workout_plans SET status=?,is_active=0,updated_at=NOW() WHERE id=?',{replacements:[archived?'archived':'available',id],type:QueryTypes.UPDATE,transaction});return true;});}
  async deletePlan(userId:string,id:string):Promise<boolean>{return this.db.transaction(async transaction=>{const [plan]=await this.db.query<{id:string}>('SELECT id FROM workout_plans WHERE id=? AND user_id=? FOR UPDATE',{replacements:[id,userId],type:QueryTypes.SELECT,transaction});if(!plan)return false;await this.db.query('DELETE FROM workout_plans WHERE id=?',{replacements:[id],type:QueryTypes.DELETE,transaction});return true;});}
  async complete(userId:string,input:CompleteWorkoutInput):Promise<string|null>{const rows=await this.db.query<{division_id:string;division_name:string;division_label:string;plan_id:string;plan_name:string}>('SELECT d.id division_id,d.name division_name,d.label division_label,p.id plan_id,p.name plan_name FROM workout_divisions d JOIN workout_plans p ON p.id=d.plan_id WHERE d.id=? AND p.user_id=? LIMIT 1',{replacements:[input.divisionId,userId],type:QueryTypes.SELECT});const item=rows[0];if(!item)return null;const id=randomUUID();const ids=input.completedExerciseIds??[];await this.db.query('INSERT INTO workout_sessions (id,user_id,plan_id,division_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,\'completed\',?,?,NOW(),NOW())',{replacements:[id,userId,item.plan_id,item.division_id,item.plan_name,item.division_name,item.division_label,input.performedOn,ids.length?'detailed':'quick',JSON.stringify(ids)],type:QueryTypes.INSERT});return id;}
  async listSessions(userId:string):Promise<WorkoutSession[]>{const rows=await this.db.query<SessionRow>('SELECT id,plan_id,division_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at FROM workout_sessions WHERE user_id=? ORDER BY performed_on DESC,created_at DESC LIMIT 100',{replacements:[userId],type:QueryTypes.SELECT});return rows.map(mapSession);}
  async getGoalSummary(userId: string, date: string): Promise<WorkoutGoalSummary> {
    const [stored] = await this.db.query<GoalRow>('SELECT weekly_target,mode,schedule FROM workout_goals WHERE user_id=? LIMIT 1', { replacements: [userId], type: QueryTypes.SELECT });
    const configured = Boolean(stored); const weeklyTarget = stored?.weekly_target ?? 3; const mode = stored?.mode ?? 'flexible';
    const schedule = normalizeSchedule(stored?.schedule);
    const current = new Date(`${date}T12:00:00`); const offset = (current.getDay() + 6) % 7;
    const monday = new Date(current); monday.setDate(current.getDate() - offset); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekStart = localDate(monday); const weekEnd = localDate(sunday);
    const sessions = await this.db.query<{ performed_on: string; total: number }>('SELECT performed_on,COUNT(*) total FROM workout_sessions WHERE user_id=? AND status=\'completed\' AND performed_on BETWEEN ? AND ? GROUP BY performed_on', { replacements: [userId, weekStart, weekEnd], type: QueryTypes.SELECT });
    const sessionsByDate = Object.fromEntries(sessions.map(item => [String(item.performed_on), Number(item.total)]));
    const ids = schedule.map(item => item.divisionId).filter((id): id is string => Boolean(id));
    const divisions = ids.length ? await this.db.query<{id:string;label:string;name:string}>('SELECT d.id,d.label,d.name FROM workout_divisions d JOIN workout_plans p ON p.id=d.plan_id WHERE p.user_id=? AND d.id IN (?)', { replacements: [userId, ids], type: QueryTypes.SELECT }) : [];
    const byId = new Map(divisions.map(item => [item.id, item]));
    const planned = schedule.map(item => { const target = new Date(monday); target.setDate(monday.getDate() + item.weekday - 1); const division = item.divisionId ? byId.get(item.divisionId) : undefined; return { ...item, date: localDate(target), divisionLabel: division?.label ?? null, divisionName: division?.name ?? null }; }).sort((a,b) => a.weekday-b.weekday);
    const completed = sessions.reduce((total, item) => total + Number(item.total), 0);
    return { configured, weeklyTarget, mode, schedule, weekStart, weekEnd, completed, remaining: Math.max(weeklyTarget - completed, 0), completedDays: Object.keys(sessionsByDate), sessionsByDate, nextPlanned: planned.find(item => item.date >= date) ?? null, missedPlanned: planned.filter(item => item.date < date && !sessionsByDate[item.date]) };
  }
  async getWeeklyStreak(userId:string,date:string):Promise<number>{
    const [goal]=await this.db.query<{weekly_target:number}>('SELECT weekly_target FROM workout_goals WHERE user_id=? LIMIT 1',{replacements:[userId],type:QueryTypes.SELECT});const target=goal?.weekly_target??3;
    const rows=await this.db.query<{performed_on:string}>("SELECT performed_on FROM workout_sessions WHERE user_id=? AND status='completed' AND performed_on>=DATE_SUB(?,INTERVAL 370 DAY)",{replacements:[userId,date],type:QueryTypes.SELECT});
    const counts=new Map<string,number>();for(const row of rows){const d=new Date(`${String(row.performed_on).slice(0,10)}T12:00:00Z`);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);const key=d.toISOString().slice(0,10);counts.set(key,(counts.get(key)??0)+1);}
    const cursor=new Date(`${date}T12:00:00Z`);cursor.setUTCDate(cursor.getUTCDate()-((cursor.getUTCDay()+6)%7));let streak=0;while((counts.get(cursor.toISOString().slice(0,10))??0)>=target){streak++;cursor.setUTCDate(cursor.getUTCDate()-7);}return streak;
  }
  async saveGoal(userId: string, input: WorkoutGoalInput): Promise<boolean> {
    const ids = input.schedule.map(item => item.divisionId).filter((id): id is string => Boolean(id));
    if (ids.length) { const [{ total }] = await this.db.query<{total:number}>('SELECT COUNT(*) total FROM workout_divisions d JOIN workout_plans p ON p.id=d.plan_id WHERE p.user_id=? AND d.id IN (?)', { replacements: [userId, ids], type: QueryTypes.SELECT }); if (Number(total) !== new Set(ids).size) return false; }
    await this.db.query('INSERT INTO workout_goals (id,user_id,weekly_target,mode,schedule,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE weekly_target=VALUES(weekly_target),mode=VALUES(mode),schedule=VALUES(schedule),updated_at=NOW()', { replacements: [randomUUID(), userId, input.weeklyTarget, input.mode, JSON.stringify(input.schedule)], type: QueryTypes.INSERT });
    return true;
  }
  async updateSession(userId:string,id:string,input:UpdateWorkoutSessionInput):Promise<boolean>{const [owned]=await this.db.query<{id:string}>('SELECT id FROM workout_sessions WHERE id=? AND user_id=?',{replacements:[id,userId],type:QueryTypes.SELECT});if(!owned)return false;const fields:string[]=[];const values:unknown[]=[];if(input.performedOn){fields.push('performed_on=?');values.push(input.performedOn);}if(input.status){fields.push('status=?');values.push(input.status);}if(input.completedExerciseIds){fields.push('completed_exercise_ids=?','completion_mode=?');values.push(JSON.stringify(input.completedExerciseIds),input.completedExerciseIds.length?'detailed':'quick');}values.push(id);await this.db.query(`UPDATE workout_sessions SET ${fields.join(',')},updated_at=NOW() WHERE id=?`,{replacements:values,type:QueryTypes.UPDATE});return true;}
}
function mapSession(row:SessionRow):WorkoutSession{let ids:string[]=[];try{ids=Array.isArray(row.completed_exercise_ids)?row.completed_exercise_ids:JSON.parse(row.completed_exercise_ids);}catch{}return{id:row.id,planId:row.plan_id,divisionId:row.division_id,planDeleted:row.plan_id===null,planName:row.plan_id===null?'Ficha excluída':row.plan_name,divisionName:row.division_name,divisionLabel:row.division_label,performedOn:String(row.performed_on),status:row.status,completionMode:row.completion_mode,completedExerciseIds:ids,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()};}
function localDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`; }
function normalizeSchedule(value: unknown): WorkoutGoalInput['schedule'] { if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } } if (!Array.isArray(value)) return []; return value.filter((item): item is WorkoutGoalInput['schedule'][number] => Boolean(item) && typeof item === 'object' && Number.isInteger((item as {weekday?:unknown}).weekday) && Number((item as {weekday:number}).weekday) >= 1 && Number((item as {weekday:number}).weekday) <= 7 && (((item as {divisionId?:unknown}).divisionId === null) || typeof (item as {divisionId?:unknown}).divisionId === 'string')).map(item => ({ weekday: item.weekday, divisionId: item.divisionId })); }
