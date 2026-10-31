import type { HealthItem, HealthTodayItem } from '@fit/contracts';
import { formatTimeInput } from './input-format';

export const healthUnits = [['capsule', 'cápsula(s)'], ['tablet', 'comprimido(s)'], ['g', 'g'], ['mg', 'mg'], ['ml', 'mL'], ['drop', 'gota(s)'], ['dose', 'dose(s)'], ['scoop', 'scoop(s)'], ['other', 'unidade(s)']] as const;

export const formatHealthTimeInput = formatTimeInput;

export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function isHealthIntakeLate(entry: Pick<HealthTodayItem, 'consumedAt' | 'time'>, date: string, now = new Date()) {
  if (entry.consumedAt || !entry.time) return false;
  const today = localDay(now);
  return date < today || (date === today && entry.time < `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
}
export function healthDose(item: HealthItem) {
  const amount = item.amount == null ? '' : item.amount.toLocaleString('pt-BR');
  const unit = healthUnits.find(([value]) => value === item.unit)?.[1] ?? '';
  return [amount ? `${amount} ${unit}`.trim() : '', item.strength].filter(Boolean).join(' · ') || 'Quantidade não informada';
}
