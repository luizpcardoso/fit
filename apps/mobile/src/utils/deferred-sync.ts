/** One timer per dirty batch; no polling when idle and no request per interaction. */
export function createDeferredSync(options: {
  run(): Promise<void>;
  pending(): boolean;
  delay?: number;
  clock?: { now(): number; set(work: () => void, delay: number): unknown; clear(timer: unknown): void };
}) {
  const delay = options.delay ?? 60_000;
  const clock = options.clock ?? { now: Date.now, set: (work: () => void, ms: number) => setTimeout(work, ms), clear: (timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>) };
  let timer: unknown, work: Promise<void> | null = null, disposed = false, failures = 0, retryAt = 0, urgent = false;
  const cancel = () => { if (timer !== undefined) clock.clear(timer); timer = undefined; };
  const schedule = () => {
    if (disposed) return;
    if (!options.pending()) { cancel(); return; }
    if (timer !== undefined) return;
    timer = clock.set(() => { timer = undefined; void flush(); }, retryAt ? Math.max(1, retryAt - clock.now()) : delay);
  };
  const flush = async (force = false): Promise<void> => {
    if (disposed) return;
    if (!options.pending()) { cancel(); return; }
    if (work) { if (force) urgent = true; return work; }
    if (!force && clock.now() < retryAt) { schedule(); return; }
    cancel();
    work = Promise.resolve().then(options.run).then(() => { failures = 0; retryAt = 0; }, () => {
      failures += 1; retryAt = clock.now() + Math.min(300_000, 60_000 * 2 ** Math.min(failures - 1, 3));
    }).finally(() => {
      work = null;
      if (urgent && !retryAt && !disposed) { urgent = false; void flush(); }
      else { urgent = false; schedule(); }
    });
    await work;
  };
  return { schedule, flush, resume: () => { disposed = false; schedule(); }, dispose: () => { disposed = true; cancel(); } };
}
