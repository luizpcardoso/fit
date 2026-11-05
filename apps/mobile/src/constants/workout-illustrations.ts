import type { WorkoutIllustrationId } from '@fit/contracts';

export const workoutIllustrations: readonly { id: WorkoutIllustrationId; name: string; combination: boolean; source: number }[] = [
  { id: 'chest', name: 'Peito', combination: false, source: require('../../assets/images/workout-groups/chest.webp') },
  { id: 'back', name: 'Costas', combination: false, source: require('../../assets/images/workout-groups/back.webp') },
  { id: 'legs', name: 'Pernas', combination: false, source: require('../../assets/images/workout-groups/legs.webp') },
  { id: 'shoulders', name: 'Ombros', combination: false, source: require('../../assets/images/workout-groups/shoulders.webp') },
  { id: 'arms', name: 'Braços', combination: false, source: require('../../assets/images/workout-groups/arms.webp') },
  { id: 'core', name: 'Abdômen', combination: false, source: require('../../assets/images/workout-groups/core.webp') },
  { id: 'glutes', name: 'Glúteos', combination: false, source: require('../../assets/images/workout-groups/glutes.webp') },
  { id: 'full-body', name: 'Corpo inteiro', combination: false, source: require('../../assets/images/workout-groups/full-body.webp') },
  { id: 'back-shoulders', name: 'Costas + ombros', combination: true, source: require('../../assets/images/workout-groups/back-shoulders.webp') },
  { id: 'chest-shoulders', name: 'Peito + ombros', combination: true, source: require('../../assets/images/workout-groups/chest-shoulders.webp') },
  { id: 'chest-triceps', name: 'Peito + tríceps', combination: true, source: require('../../assets/images/workout-groups/chest-triceps.webp') },
  { id: 'back-biceps', name: 'Costas + bíceps', combination: true, source: require('../../assets/images/workout-groups/back-biceps.webp') },
  { id: 'legs-glutes', name: 'Pernas + glúteos', combination: true, source: require('../../assets/images/workout-groups/legs-glutes.webp') },
];

export function getWorkoutIllustration(id?: string | null) {
  return workoutIllustrations.find(item => item.id === id);
}
