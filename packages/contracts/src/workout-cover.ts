import { z } from 'zod';
export const workoutCoverIds = ['running-woman', 'running-man', 'muscle-woman', 'muscle-man', 'strength', 'conditioning', 'mobility', 'wellness'] as const;
export const workoutCoverIdSchema = z.enum(workoutCoverIds);
export type WorkoutCoverId = z.infer<typeof workoutCoverIdSchema>;
export const workoutCovers: readonly { id: WorkoutCoverId; name: string; description: string }[] = [
  { id: 'running-woman', name: 'Corrida · mulher', description: 'Corrida, emagrecimento e atividade aeróbica' },
  { id: 'running-man', name: 'Corrida · homem', description: 'Corrida, emagrecimento e atividade aeróbica' },
  { id: 'muscle-woman', name: 'Musculação · mulher', description: 'Ganho de massa e hipertrofia' },
  { id: 'muscle-man', name: 'Musculação · homem', description: 'Ganho de massa e hipertrofia' },
  { id: 'strength', name: 'Força', description: 'Força e treinamento com cargas' },
  { id: 'conditioning', name: 'Condicionamento', description: 'Circuitos, funcional e resistência física' },
  { id: 'mobility', name: 'Mobilidade', description: 'Alongamento, flexibilidade e mobilidade' },
  { id: 'wellness', name: 'Bem-estar', description: 'Bem-estar físico, adaptação e atividade geral' },
];
/** Default artwork only; uses program labels, never a person's profile or health data. */
export function defaultWorkoutCover(name: string, audience?: string, goal = ''): WorkoutCoverId {
  const text = `${name} ${goal}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const female = audience === 'female' || /\bfeminin/.test(text);
  const male = audience === 'male' || /\bmasculin/.test(text);
  if (/mobilidade|alongamento|flexibilidade|yoga|pilates/.test(text)) return 'mobility';
  if (/hipertrofia|ganh.{0,12}massa|massa muscular|musculacao|definicao/.test(text)) return female ? 'muscle-woman' : male ? 'muscle-man' : 'strength';
  if (/forca|power|carga/.test(text)) return 'strength';
  if (/emagrec|perd.{0,12}peso|gordura|corrida|cardio|aerob/.test(text)) return female ? 'running-woman' : male ? 'running-man' : 'conditioning';
  if (/condicionamento|funcional|circuito|performance|resistencia/.test(text)) return 'conditioning';
  return 'wellness';
}
