import { useEffect } from 'react';
import { api, getToken } from '../api/client';
import { useUiStore, AppNotification, PageId } from './uiStore';

// In-app notifications come from the server (leave decisions, approvals waiting, payslips,
// assignments ...). The bell polls, refreshes when the tab regains focus, and keeps the
// read/cleared state on the server so every device agrees.

interface ServerNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  created_at: string;
  read_at?: string | null;
}

const POLL_MS = 30_000;

const PAGES: ReadonlySet<string> = new Set<PageId>([
  'hub', 'attendance', 'leaves', 'profile', 'payroll', 'shifts', 'radar', 'approvals', 'capacity',
  'directory', 'onboarding', 'company_settings', 'kanban', 'list', 'backlog', 'pulse',
]);

const TYPES: Record<string, AppNotification['type']> = {
  leave: 'leave',
  approval: 'approval',
  attendance: 'punch',
  work: 'work',
};

const toApp = (n: ServerNotification): AppNotification => ({
  id: n.id,
  title: n.title,
  message: n.body,
  timestamp: n.created_at,
  type: TYPES[n.category] ?? 'system',
  read: !!n.read_at,
  actionLink: n.link && PAGES.has(n.link) ? (n.link as PageId) : undefined,
});

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
export const formatNotificationTime = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

let inFlight: Promise<void> | null = null;
let loadedOnce = false;

/** Loads the newest notifications; toasts the ones that arrived since the last load. */
export const refreshNotifications = (): Promise<void> => {
  if (!getToken()) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await api.get<{ items: ServerNotification[]; unread_count: number }>('/notifications?limit=50');
      const items = (res?.items ?? []).map(toApp);
      const ui = useUiStore.getState();
      if (loadedOnce) {
        const known = new Set(ui.notifications.map((n) => n.id));
        const fresh = items.filter((n) => !n.read && !known.has(n.id));
        if (fresh.length === 1) ui.addToast({ type: 'info', message: fresh[0].title });
        else if (fresh.length > 1) ui.addToast({ type: 'info', message: `${fresh.length} new notifications` });
      }
      loadedOnce = true;
      ui.setNotifications(items);
    } catch {
      // Offline or signed out: keep what is shown and try again on the next tick.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

/** Forget the previous user's notifications (sign-out / account switch). */
export const resetNotifications = () => {
  loadedOnce = false;
  useUiStore.getState().setNotifications([]);
};

/** Keeps the bell current while someone is signed in. */
export const useNotificationPolling = (signedIn: boolean) => {
  useEffect(() => {
    if (!signedIn) {
      resetNotifications();
      return;
    }
    refreshNotifications();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshNotifications();
    }, POLL_MS);
    const onFocus = () => refreshNotifications();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [signedIn]);
};
