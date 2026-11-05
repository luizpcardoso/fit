import { QueryTypes, type QueryInterface } from 'sequelize';
import { additionalCatalogExercises } from '../exercise-catalog-expansion.js';
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export async function up({context:q}: {context:QueryInterface}) {
  await q.sequelize.transaction(async transaction => {
    const existing=await q.sequelize.query<{name:string}>("SELECT name FROM exercises WHERE source='catalog'",{type:QueryTypes.SELECT,transaction});
    const names=new Set(existing.map(row=>normalize(row.name)));
    const rows=additionalCatalogExercises.filter(item=>!names.has(normalize(item.name))).map(item=>({id:item.id,name:item.name,source:'catalog',owner_user_id:null,category:item.category,equipment:item.equipment,primary_muscle:item.primaryMuscle,created_at:new Date(),updated_at:new Date()}));
    if(rows.length) await q.bulkInsert('exercises',rows,{transaction});
    await q.sequelize.query(`INSERT INTO portal_content (id,owner_id,kind,scope,name,data,revision,archived,created_at,updated_at)
      SELECT e.id,admin.user_id,'exercise','global',e.name,JSON_OBJECT('category',e.category,'equipment',e.equipment,'primaryMuscle',e.primary_muscle,'notes',''),1,FALSE,e.created_at,e.updated_at
      FROM exercises e JOIN (SELECT user_id FROM portal_accounts WHERE role='admin' ORDER BY user_id LIMIT 1) admin
      LEFT JOIN portal_content p ON p.id=e.id WHERE e.id IN (:ids) AND p.id IS NULL`,{replacements:{ids:additionalCatalogExercises.map(item=>item.id)},transaction});
  });
}
export async function down({context:q}: {context:QueryInterface}) {
  const replacements={ids:additionalCatalogExercises.map(item=>item.id)};
  // Preserve content already edited by administrators or referenced by saved workouts.
  await q.sequelize.query(`DELETE p FROM portal_content p LEFT JOIN portal_content_versions v ON v.content_id=p.id LEFT JOIN professional_assignments a ON a.source_id=p.id WHERE p.id IN (:ids) AND p.revision=1 AND v.id IS NULL AND a.id IS NULL`,{replacements});
  await q.sequelize.query(`DELETE e FROM exercises e LEFT JOIN workout_plan_exercises w ON w.exercise_id=e.id LEFT JOIN portal_content p ON p.id=e.id LEFT JOIN suggested_workout_exercises s ON s.exercise_id=e.id WHERE e.id IN (:ids) AND w.id IS NULL AND p.id IS NULL AND s.id IS NULL`,{replacements});
}
