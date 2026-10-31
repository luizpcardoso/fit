/** Increment numeric repetitions or both ends of an existing range. */
export function stepRepetitions(value: string, direction: -1 | 1): string | null {
  const match = /^(\d+)(?:\s*([–-])\s*(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const start = Number(match[1]) + direction;
  const end = match[3] == null ? null : Number(match[3]) + direction;
  if (start < 1 || start > 999 || (end != null && (end < start || end > 999))) return null;
  return end == null ? String(start) : `${start}${match[2]}${end}`;
}
export function stepWorkoutNumber(value: number | null | undefined, direction: -1 | 1, step: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(((Number.isFinite(value) ? value! : min) + direction * step) * 100) / 100));
}
