export function validityDeadline(days: number | null | undefined, now = new Date()): Date | null {
  if (days == null) return null;
  const deadline = new Date(now);
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return deadline;
}
export function planValidity(deadline: Date | string | null, now = new Date()) {
  const date = deadline == null ? null : new Date(deadline);
  return { validUntil: date?.toISOString() ?? null, isExpired: date !== null && date.getTime() <= now.getTime() };
}

// Raw SQL replacements otherwise serialize Dates using the process timezone.
export function validitySqlValue(deadline: Date | null): string | null {
  return deadline?.toISOString().slice(0, 19).replace('T', ' ') ?? null;
}
