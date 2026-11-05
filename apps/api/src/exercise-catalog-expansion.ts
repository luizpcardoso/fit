import { seedId, type CatalogSeed } from './seed-content.js';

// Additional equipment variations; keep existing names and IDs used in saved plans.
const groups: {muscle:string; equipment:string; names:string[]}[] = [
  {muscle:'bíceps',equipment:'halteres',names:['Rosca direta com halteres','Rosca Scott com halter','Rosca spider com halteres','Rosca martelo no banco inclinado']},
  {muscle:'bíceps',equipment:'cabos',names:['Rosca Bayesian unilateral no cabo']},
  {muscle:'bíceps e antebraços',equipment:'barra W',names:['Rosca inversa com barra W']},
  {muscle:'antebraços',equipment:'barra',names:['Flexão de punho com barra','Extensão de punho com barra']},
  {muscle:'peitoral',equipment:'cabos',names:['Supino inclinado no cabo','Crucifixo unilateral no cabo']},
  {muscle:'costas e bíceps',equipment:'polia',names:['Puxada na polia com pegada supinada']},
  {muscle:'ombros e trapézio',equipment:'cabos e corda',names:['Remada alta no cabo com corda']},
  {muscle:'ombros',equipment:'cabos',names:['Elevação lateral no cabo por trás do corpo']},
  {muscle:'quadríceps e glúteos',equipment:'Smith',names:['Agachamento búlgaro no Smith','Passada reversa no Smith']},
  {muscle:'posterior de coxa',equipment:'máquina',names:['Flexora em pé unilateral']},
  {muscle:'glúteos e abdutores',equipment:'peso corporal',names:['Abdução de quadril deitado']},
  {muscle:'panturrilhas',equipment:'halter',names:['Panturrilha unilateral com halter']},
  {muscle:'abdômen',equipment:'cabos',names:['Pallof press ajoelhado']},
  {muscle:'abdômen e ombros',equipment:'halter',names:['Prancha com arrasto de halter']},
  {muscle:'quadríceps e glúteos',equipment:'step',names:['Step-up lateral']},
];
export const additionalCatalogExercises: CatalogSeed[] = groups.flatMap(group => group.names.map(name => ({
  id:seedId(`expansion-202611:${name}`),name,category:'strength',equipment:group.equipment,primaryMuscle:group.muscle,
})));
