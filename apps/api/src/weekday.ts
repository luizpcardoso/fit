/** Monday = 1 … Sunday = 7 for a local YYYY-MM-DD date. */
export const weekdayFromDate = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
