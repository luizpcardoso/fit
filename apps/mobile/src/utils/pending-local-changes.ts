const guards = new Map<string, Set<() => Promise<boolean>>>();
export function registerPendingLocalChanges(owner: string, guard: () => Promise<boolean>) {
  const set = guards.get(owner) ?? new Set(); set.add(guard); guards.set(owner, set);
  return () => { set.delete(guard); if (!set.size) guards.delete(owner); };
}
export async function hasPendingLocalChanges(owner: string) {
  const checks = await Promise.all([...(guards.get(owner) ?? [])].map(guard => guard().catch(() => true)));
  return checks.some(Boolean);
}
