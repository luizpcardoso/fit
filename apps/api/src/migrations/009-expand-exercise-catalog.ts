import { QueryTypes, type QueryInterface } from 'sequelize';
import { seedId } from '../seed-content.js';

type ExtraExercise = {
  name: string;
  category: 'strength' | 'cardio' | 'mobility' | 'flexibility' | 'functional';
  equipment: string;
  primaryMuscle: string;
};

// Nomes alternativos e aparelhos comuns encontrados em academias brasileiras.
// Mantemos os dois formatos quando ambos são usados na prática (por exemplo,
// "Crossover alto" e "Crossover alto para baixo") para a busca ser natural.
const exercises: ExtraExercise[] = [
  { name: 'Supino reto máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'peitoral' },
  { name: 'Supino inclinado máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'peitoral' },
  { name: 'Supino declinado máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'peitoral' },
  { name: 'Supino com pegada neutra', category: 'strength', equipment: 'halteres', primaryMuscle: 'peitoral' },
  { name: 'Crossover alto', category: 'strength', equipment: 'cabos', primaryMuscle: 'peitoral' },
  { name: 'Crossover baixo', category: 'strength', equipment: 'cabos', primaryMuscle: 'peitoral' },
  { name: 'Crossover médio', category: 'strength', equipment: 'cabos', primaryMuscle: 'peitoral' },
  { name: 'Crossover alto unilateral', category: 'strength', equipment: 'cabos', primaryMuscle: 'peitoral' },
  { name: 'Crossover baixo unilateral', category: 'strength', equipment: 'cabos', primaryMuscle: 'peitoral' },
  { name: 'Voador peitoral', category: 'strength', equipment: 'máquina', primaryMuscle: 'peitoral' },
  { name: 'Voador invertido', category: 'strength', equipment: 'máquina', primaryMuscle: 'ombros posteriores' },
  { name: 'Puxada alta frente', category: 'strength', equipment: 'polia', primaryMuscle: 'costas' },
  { name: 'Puxada triângulo', category: 'strength', equipment: 'polia', primaryMuscle: 'costas' },
  { name: 'Puxada alta unilateral', category: 'strength', equipment: 'polia', primaryMuscle: 'costas' },
  { name: 'Puxada unilateral ajoelhada', category: 'strength', equipment: 'cabos', primaryMuscle: 'costas' },
  { name: 'Remada baixa máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'costas' },
  { name: 'Remada cavalinho máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'costas' },
  { name: 'Barra fixa neutra', category: 'strength', equipment: 'barra fixa', primaryMuscle: 'costas' },
  { name: 'Barra fixa assistida neutra', category: 'strength', equipment: 'máquina', primaryMuscle: 'costas' },
  { name: 'Barra fixa com elástico', category: 'strength', equipment: 'barra fixa e elástico', primaryMuscle: 'costas' },
  { name: 'Rosca direta máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'bíceps' },
  { name: 'Rosca martelo máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'bíceps' },
  { name: 'Rosca spider', category: 'strength', equipment: 'barra ou halteres', primaryMuscle: 'bíceps' },
  { name: 'Rosca drag', category: 'strength', equipment: 'barra', primaryMuscle: 'bíceps' },
  { name: 'Rosca no banco inclinado', category: 'strength', equipment: 'halteres', primaryMuscle: 'bíceps' },
  { name: 'Rosca cabo alto bilateral', category: 'strength', equipment: 'cabos', primaryMuscle: 'bíceps' },
  { name: 'Cadeira adutora', category: 'strength', equipment: 'máquina', primaryMuscle: 'adutores' },
  { name: 'Cadeira abdutora', category: 'strength', equipment: 'máquina', primaryMuscle: 'abdutores e glúteos' },
  { name: 'Adutora unilateral máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'adutores' },
  { name: 'Abdutora unilateral máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'abdutores e glúteos' },
  { name: 'Cadeira flexora unilateral', category: 'strength', equipment: 'máquina', primaryMuscle: 'posterior de coxa' },
  { name: 'Mesa flexora com pausa', category: 'strength', equipment: 'máquina', primaryMuscle: 'posterior de coxa' },
  { name: 'Cadeira extensora bilateral', category: 'strength', equipment: 'máquina', primaryMuscle: 'quadríceps' },
  { name: 'Abdominal solo', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen' },
  { name: 'Abdominal supra no solo', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen' },
  { name: 'Abdominal infra no solo', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen' },
  { name: 'Abdominal oblíquo no solo', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen' },
  { name: 'Abdominal máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'abdômen' },
  { name: 'Abdominal no banco declinado', category: 'strength', equipment: 'banco', primaryMuscle: 'abdômen' },
  { name: 'Abdominal na bola suíça', category: 'strength', equipment: 'bola suíça', primaryMuscle: 'abdômen' },
  { name: 'Abdominal remador', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen' },
  { name: 'Prancha lateral com elevação de quadril', category: 'strength', equipment: 'peso corporal', primaryMuscle: 'abdômen e glúteos' },
  { name: 'Elevação lateral máquina unilateral', category: 'strength', equipment: 'máquina', primaryMuscle: 'ombros' },
  { name: 'Peck deck unilateral', category: 'strength', equipment: 'máquina', primaryMuscle: 'peitoral' },
  { name: 'Leg press 45 graus unilateral', category: 'strength', equipment: 'máquina', primaryMuscle: 'quadríceps e glúteos' },
  { name: 'Hack squat máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'quadríceps e glúteos' },
  { name: 'Glúteo quatro apoios máquina', category: 'strength', equipment: 'máquina', primaryMuscle: 'glúteos' },
  { name: 'Panturrilha no leg press 45 graus', category: 'strength', equipment: 'máquina', primaryMuscle: 'panturrilhas' },
];

export async function up({ context }: { context: QueryInterface }) {
  const existingRows = await context.sequelize.query<{ name: string }>("SELECT name FROM exercises WHERE source='catalog'", { type: QueryTypes.SELECT });
  const existing = new Set(existingRows.map((item) => item.name));
  const now = new Date();
  const rows = exercises
    .filter((exercise) => !existing.has(exercise.name))
    .map((exercise) => ({
      id: seedId(`expanded:${exercise.name}`),
      owner_user_id: null,
      name: exercise.name,
      source: 'catalog',
      category: exercise.category,
      equipment: exercise.equipment,
      primary_muscle: exercise.primaryMuscle,
      created_at: now,
      updated_at: now,
    }));
  if (rows.length) await context.bulkInsert('exercises', rows);
}

export async function down({ context }: { context: QueryInterface }) {
  await context.sequelize.query("DELETE FROM exercises WHERE source='catalog' AND name IN (:names)", { replacements: { names: exercises.map((exercise) => exercise.name) } });
}
