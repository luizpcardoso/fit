import { z } from 'zod';
export const pageQuerySchema = z.strictObject({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(5) });
export const healthPageQuerySchema = pageQuerySchema.extend({ search: z.string().trim().max(100).default(''), status: z.enum(['all', 'active', 'paused']).default('all') });
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type HealthPageQuery = z.infer<typeof healthPageQuerySchema>;
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
export function pageWindow(total: number, query: PageQuery) {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  return { page, pageSize: query.pageSize, total, totalPages, offset: (page - 1) * query.pageSize };
}
