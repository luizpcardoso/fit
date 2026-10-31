/** Date-only values travel as YYYY-MM-DD in the user's local calendar. */
const pad = (value: number) => String(value).padStart(2, '0');

export function localDate(value = new Date()) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
/** Parses YYYY-MM-DD at local noon so the day never shifts across time zones. */
export function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function shiftDate(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
/** "30/10/2026" */
export function formatDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('pt-BR');
}
/** "30 de out." or "30 de out. de 2025" when outside the current year. */
export function formatShortDate(value: string, reference = new Date()) {
  const date = parseLocalDate(value);
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(date.getFullYear() === reference.getFullYear() ? {} : { year: 'numeric' }) });
}
/** "Hoje", "Ontem", "Amanhã" or "sex., 30 de out." — for day navigators and list headers. */
export function formatRelativeDay(value: string, reference = new Date()) {
  const today = localDate(reference);
  if (value === today) return 'Hoje';
  if (value === shiftDate(today, -1)) return 'Ontem';
  if (value === shiftDate(today, 1)) return 'Amanhã';
  const date = parseLocalDate(value);
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', ...(date.getFullYear() === reference.getFullYear() ? {} : { year: 'numeric' }) });
}
/** Full form for screen readers: "sexta-feira, 30 de outubro de 2026". */
export function formatSpokenDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
