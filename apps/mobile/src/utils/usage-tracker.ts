import { screenFeatures, type AnalyticsBatch, type AnalyticsEvent, type AnalyticsPlatform, type AnalyticsScreen } from '@fit/contracts';

const paths: Record<string, AnalyticsScreen> = {
  '/': 'home', '/workouts': 'workouts', '/workout-create': 'workout_create', '/workout-detail': 'workout_detail', '/workout-run': 'workout_run', '/session-edit': 'session_edit',
  '/nutrition': 'nutrition', '/food-tracking': 'food_tracking', '/diet': 'diet', '/body-measurements': 'body_measurements', '/health': 'health', '/health-routine': 'health_routine',
  '/mental-wellbeing': 'mental_wellbeing', '/injectables': 'injectables', '/groups': 'groups', '/group-detail': 'group_detail', '/group-post': 'group_post', '/group-manage': 'group_manage',
  '/group-notifications': 'group_notifications', '/my-professionals': 'my_professionals', '/settings': 'settings', '/profile-details': 'profile_details', '/feedback': 'feedback', '/blocked-users': 'blocked_users',
};
// Unknown routes and login/registration are deliberately excluded. Never forward URLs or parameters.
export const analyticsScreenForPath = (path: string): AnalyticsScreen | null => paths[path.split('?')[0].replace(/\/$/, '') || '/'] ?? null;
export const validAnalyticsVersion = (version: string | undefined | null) => /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][a-zA-Z0-9.-]{1,20})?$/.test(version || '') ? version! : '0.0.0';

type Options = {
  send(batch: AnalyticsBatch, signal: AbortSignal): Promise<unknown>;
  uuid(): string; platform: AnalyticsPlatform; version: string; now?: () => number;
};
export class UsageTracker {
  private queue: AnalyticsEvent[] = [];
  private foreground = false;
  private disposed = false;
  private screen: AnalyticsScreen | null = null;
  private lastScreen: AnalyticsScreen | null = null;
  private sessionId = '';
  private lastActive = 0;
  private lastHeartbeat = 0;
  private sending = false;
  private abort: AbortController | null = null;
  private now: () => number;
  constructor(private options: Options) { this.now = options.now ?? Date.now; }
  setScreen(screen: AnalyticsScreen | null) { this.screen = screen; this.visit(); }
  setForeground(active: boolean) {
    if (this.disposed || this.foreground === active) return;
    this.foreground = active;
    if (active) {
      if (!this.sessionId || this.now() - this.lastActive >= 30 * 60_000) {
        this.sessionId = this.options.uuid(); this.add('session_start');
      }
      this.lastScreen = null;
      this.add('heartbeat'); this.lastHeartbeat = this.now(); this.lastActive = this.now(); this.visit();
      void this.flush();
    } else {
      this.lastActive = this.now(); this.lastScreen = null;
      // No request or heartbeat is started while the app is in the background.
    }
  }
  tick() {
    if (this.disposed || !this.foreground) return;
    if (this.now() - this.lastHeartbeat >= 60_000) {
      this.add('heartbeat'); this.lastHeartbeat = this.now(); this.lastActive = this.now();
    }
    void this.flush();
  }
  private visit() {
    if (!this.foreground || !this.screen || this.lastScreen === this.screen || this.disposed) return;
    if (!screenFeatures[this.screen]) return;
    this.add('screen_view', this.screen); this.lastScreen = this.screen;
  }
  private add(type: 'screen_view' | 'session_start' | 'heartbeat', screen?: AnalyticsScreen) {
    const base = { id: this.options.uuid(), sessionId: this.sessionId, occurredAt: new Date(this.now()).toISOString(), platform: this.options.platform, appVersion: validAnalyticsVersion(this.options.version) };
    this.queue.push(type === 'screen_view' ? { ...base, type, screen: screen! } : { ...base, type });
    if (this.queue.length > 100) this.queue.shift();
  }
  async flush() {
    if (this.disposed || this.sending || !this.foreground) return;
    this.queue = this.queue.filter(event => this.now() - Date.parse(event.occurredAt) < 3_600_000);
    if (!this.queue.length) return;
    const batch = this.queue.slice(0, 20); this.sending = true;
    const controller = new AbortController(); this.abort = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await this.options.send({ events: batch }, controller.signal);
      if (!this.disposed) { const sent = new Set(batch.map(event => event.id)); this.queue = this.queue.filter(event => !sent.has(event.id)); }
    } catch (error) {
      // Retry transient failures with stable IDs. Invalid/unauthorized batches cannot be fixed by replaying them.
      const status = (error as { status?: number })?.status;
      if (!this.disposed && status && [400, 401, 403, 404, 410, 413, 422].includes(status)) {
        const rejected = new Set(batch.map(event => event.id)); this.queue = this.queue.filter(event => !rejected.has(event.id));
      }
    }
    finally { clearTimeout(timeout); this.abort = null; this.sending = false; }
  }
  dispose() { this.disposed = true; this.queue = []; this.abort?.abort(); }
}
