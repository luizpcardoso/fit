import type { DailySummary } from '@fit/contracts';
export const DAILY_SUMMARY_NOTIFICATION_ID = 'fit.daily-summary';
export async function requestDailySummaryPermission() { throw new Error('O resumo nas notificações está disponível no Android.'); }
export async function clearDailySummaryNotification() {}
export async function presentDailySummary(_summary: DailySummary, _isCurrent: () => boolean) {}
