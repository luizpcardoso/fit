export function bodyValuesForEntry(values: Record<string, number | null>, mode: 'weight' | 'measurements' | 'full') {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, mode === 'weight' && key !== 'weightKg' || mode === 'measurements' && key === 'weightKg' ? null : value]));
}
