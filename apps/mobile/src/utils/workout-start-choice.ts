import type { WorkoutGoalSummary, WorkoutPlan, WorkoutSession } from '@fit/contracts';
export function workoutStartChoices(plans: WorkoutPlan[], goal: WorkoutGoalSummary | null, history: WorkoutSession[], date: string, requestedPlan?: string, requestedDivision?: string, suggestedDivision?: string) {
  const choices = plans.filter(p => p.status === 'available').flatMap(plan => plan.divisions.filter(d => d.exercises.length > 0).map(division => ({ plan, division })));
  const weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const plannedId = goal?.schedule.find(d => d.weekday === weekday)?.divisionId;
  const planned = choices.find(c => c.division.id === plannedId);
  const active = choices.filter(c => c.plan.isActive);
  const last = history.find(s => s.status === 'completed' && s.planId === active[0]?.plan.id);
  const lastIndex = active.findIndex(c => c.division.id === last?.divisionId);
  const next = active[(lastIndex + 1) % Math.max(1, active.length)];
  const requested = choices.find(c => c.plan.id === requestedPlan && c.division.id === requestedDivision);
  return { choices, planned, suggested: requested ?? planned ?? choices.find(c => c.division.id === suggestedDivision) ?? next ?? choices[0] };
}
