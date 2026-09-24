import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface NotificationHistoryEntry extends Toast {
  at: number;
  read: boolean;
}

interface NotificationState {
  toasts: Toast[];
  history: NotificationHistoryEntry[];
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
}

const HISTORY_LIMIT = 30;

// In-memory only per frontend-architecture.md §4 - toasts (and their history)
// don't survive reload. `history` backs the notification bell in the top bar,
// keeping every toast this session ever pushed (capped) even after its
// dismissible copy in `toasts` is closed.
export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  history: [],
  pushToast: (kind, message) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return {
        toasts: [...state.toasts, { id, kind, message }],
        history: [{ id, kind, message, at: Date.now(), read: false }, ...state.history].slice(0, HISTORY_LIMIT),
      };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  markAllRead: () => set((state) => ({ history: state.history.map((h) => ({ ...h, read: true })) })),
}));
