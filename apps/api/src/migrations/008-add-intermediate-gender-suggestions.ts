import type { QueryInterface, QueryOptions } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { seedId, suggestedPlans } from '../seed-content.js';

export async function up({ context }: { context: QueryInterface }) {
  // Migration 007 already includes these seeds on fresh installations. Preserve existing rows.
  const insertOptions: QueryOptions & { ignoreDuplicates: boolean } = { ignoreDuplicates: true };
  const now = new Date(); const extra = suggestedPlans.filter(plan => plan.id === seedId('template-female-intermediate') || plan.id === seedId('template-male-intermediate'));
  const catalog = await context.sequelize.query<{id:string;name:string}>('SELECT id,name FROM exercises WHERE source=\'catalog\'', { type: QueryTypes.SELECT }); const exerciseIds = new Map(catalog.map(item => [item.name,item.id]));
  for (const plan of extra) {
    await context.bulkInsert('suggested_workout_plans', [{ id:plan.id,name:plan.name,audience:plan.audience,goal:plan.goal,level:plan.level,description:plan.description,reference:plan.reference,created_at:now,updated_at:now }], insertOptions);
    for (const [divisionIndex, division] of plan.divisions.entries()) { const divisionId=seedId(`suggestion-division:${plan.id}:${divisionIndex}`); await context.bulkInsert('suggested_workout_divisions',[{id:divisionId,plan_id:plan.id,name:division.name,position:divisionIndex,created_at:now,updated_at:now}], insertOptions); const exercises=division.exercises.map((name,index)=>({id:seedId(`suggestion-exercise:${divisionId}:${index}`),division_id:divisionId,exercise_id:exerciseIds.get(name),sets:3,reps:'12',rest_seconds:60,position:index,created_at:now,updated_at:now})); if(exercises.some(item=>!item.exercise_id)) throw new Error(`Exercício ausente na sugestão: ${division.exercises.find(name=>!exerciseIds.has(name))}`); await context.bulkInsert('suggested_workout_exercises',exercises, insertOptions); }
  }
}
export async function down({ context }: { context: QueryInterface }) { const ids=[seedId('template-female-intermediate'),seedId('template-male-intermediate')]; await context.sequelize.query('DELETE FROM suggested_workout_plans WHERE id IN (?)',{replacements:[ids]}); }
