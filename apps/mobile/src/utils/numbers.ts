/** Visible numbers always use the pt-BR decimal comma: "18,5", "77,7", "84". */
export function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits });
}
/** "84,6 cm", "18 g" — unit appended after a non-breaking space so it never wraps alone. */
export function formatMeasure(value: number, unit: string, maximumFractionDigits = 1) {
  return `${formatNumber(value, maximumFractionDigits)} ${unit}`;
}
