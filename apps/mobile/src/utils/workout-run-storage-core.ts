export type WorkoutStorageAdapter = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };

/** Two durable slots; the pointer changes only after every chunk is written. */
export function createWorkoutStorage(raw: WorkoutStorageAdapter, namespace = 'fit.workout') {
  const queues = new Map<string, Promise<unknown>>();
  function serial<T>(owner: string, work: () => Promise<T>): Promise<T> {
    const previous = queues.get(owner) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    queues.set(owner, next);
    void next.finally(() => { if (queues.get(owner) === next) queues.delete(owner); }).catch(() => {});
    return next;
  }
  async function read<T>(userId: string): Promise<T | null> {
    const key = `${namespace}.${userId}`;
    const pointer = await raw.get(key);
    if (!pointer) return null;
    const { generation, count } = JSON.parse(pointer) as { generation: string; count: number };
    if (!/^[a-z0-9-]+$/.test(generation) || !Number.isInteger(count) || count < 1 || count > 1500) throw new Error('Não foi possível recuperar o treino salvo.');
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) { const chunk = await raw.get(`${key}.${generation}.${i}`); if (chunk === null) throw new Error('O treino salvo está incompleto.'); chunks.push(chunk); }
    return JSON.parse(chunks.join('')) as T;
  }
  async function write(userId: string, value: unknown) {
    const key = `${namespace}.${userId}`, previous = await raw.get(key);
    const previousPointer = previous ? JSON.parse(previous) as { generation: string; count: number } : null;
    const generation = previousPointer?.generation === 'a' ? 'b' : 'a';
    const serialized = JSON.stringify(value), chunks: string[] = [];
    let chunk = '', bytes = 0;
    for (const character of serialized) {
      const code = character.codePointAt(0)!;
      const size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (bytes + size > 1800) { chunks.push(chunk); chunk = ''; bytes = 0; }
      chunk += character; bytes += size;
    }
    if (chunk) chunks.push(chunk);
    if (chunks.length > 1500) throw new Error('Limite de dados locais atingido. Sincronize os registros e tente novamente.');
    // Record the slot size first: logout can also remove an interrupted, uncommitted write.
    const oldCount = Number(await raw.get(`${key}.${generation}.count`) ?? 0);
    await raw.set(`${key}.${generation}.count`, String(Math.max(oldCount, chunks.length)));
    for (let i = 0; i < chunks.length; i++) await raw.set(`${key}.${generation}.${i}`, chunks[i]);
    await raw.set(key, JSON.stringify({ generation, count: chunks.length }));
    if (previousPointer && !['a', 'b'].includes(previousPointer.generation)) { for (let i = 0; i < previousPointer.count; i++) await raw.remove(`${key}.${previousPointer.generation}.${i}`).catch(() => {}); }
  }
  async function clear(userId: string) {
    const key = `${namespace}.${userId}`, previous = await raw.get(key);
    await raw.remove(key);
    for (const generation of ['a', 'b']) {
      const count = Math.min(1500, Number(await raw.get(`${key}.${generation}.count`) ?? 0));
      for (let i = 0; i < count; i++) await raw.remove(`${key}.${generation}.${i}`);
      await raw.remove(`${key}.${generation}.count`);
    }
    if (previous) { const old = JSON.parse(previous) as { generation: string; count: number }; if (!['a', 'b'].includes(old.generation)) for (let i = 0; i < old.count; i++) await raw.remove(`${key}.${old.generation}.${i}`); }
  }

  return {
    read: <T>(owner: string) => serial(owner, () => read<T>(owner)),
    write: (owner: string, value: unknown) => serial(owner, () => write(owner, value)),
    clear: (owner: string) => serial(owner, () => clear(owner)),
  };
}
