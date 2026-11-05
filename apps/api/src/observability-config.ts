import { z } from 'zod';
import type { RetentionPolicy } from './observability-model.js';

// Policy chosen by the product owner: 30 days of events and 12 months of anonymous aggregates.
export function observabilityRetention(env: Record<string, string | undefined>): RetentionPolicy {
  if (!env.ANALYTICS_RAW_RETENTION_DAYS && !env.ANALYTICS_AGGREGATE_RETENTION_MONTHS) return { rawDays: 30, aggregateMonths: 12 };
  return z.strictObject({
    rawDays: z.coerce.number().refine(value => [30, 90, 180].includes(value)),
    aggregateMonths: z.coerce.number().refine(value => [12, 24].includes(value)),
  }).parse({ rawDays: env.ANALYTICS_RAW_RETENTION_DAYS, aggregateMonths: env.ANALYTICS_AGGREGATE_RETENTION_MONTHS }) satisfies RetentionPolicy;
}

export const observabilityEnabled = (env: Record<string, string | undefined>) => z.enum(['true', 'false']).default('true').parse(env.ANALYTICS_ENABLED) === 'true';
