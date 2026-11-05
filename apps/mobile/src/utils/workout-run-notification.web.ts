export const supportsWorkoutControls = false;
export async function requestWorkoutNotificationPermission() { return false; }
export async function readWorkoutNotificationProgress(_owner: string, _id: string) { return null; }
export async function clearWorkoutNotification() {}
export async function showWorkoutNotification(_owner: string, _run: import('@fit/contracts').WorkoutRun, _isCurrent?: () => boolean) {}
export function addWorkoutNotificationListener(_open: () => void) { return () => {}; }

export async function acknowledgeWorkoutNotificationProgress(_progress: import('@fit/contracts').WorkoutRunProgress) {}

export const supportsWorkoutNavigation = false;
export function addNativeWorkoutListener(_callback: () => void) { return () => {}; }
