export function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function formatIntegerInput(value: string, maxDigits = 6) {
  return value.replace(/\D/g, '').slice(0, maxDigits);
}

export function formatDecimalInput(value: string, maxIntegerDigits = 6, maxDecimalDigits = 2) {
  const normalized = value.replace('.', ',').replace(/[^\d,]/g, '');
  const [integer = '', ...fractions] = normalized.split(',');
  const cleanInteger = integer.slice(0, maxIntegerDigits);
  if (!normalized.includes(',')) return cleanInteger;
  return `${cleanInteger},${fractions.join('').slice(0, maxDecimalDigits)}`;
}

export function formatDecimalValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '' : String(value).replace('.', ',');
}

export function formatWeightInput(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d{3})/, '').slice(0, 7);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  return `${padded.slice(0, -2)},${padded.slice(-2)}`;
}

export function formatWeightValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '';
  return value.toFixed(2).replace('.', ',');
}

export function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  if (local.length <= split) return `(${area}) ${local}`;
  return `(${area}) ${local.slice(0, split)}-${local.slice(split)}`;
}
