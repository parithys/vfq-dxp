import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

/**
 * A label/value row in a structured toast. `tone` picks the value's colour:
 * 'id' for a reference the agent will quote back, 'success' for a positive
 * state, default for plain facts.
 */
export interface ToastRow {
  label: string;
  value: string;
  tone?: 'default' | 'id' | 'success';
}

export interface ToastOptions {
  /** Quieter second line under the headline. Ignored when `rows` is set. */
  detail?: string;
  /**
   * Turns the toast into a structured card: the message becomes an uppercase
   * header and these render as label/value rows beneath a divider. For
   * notifications the agent has to READ rather than merely notice - a queue
   * assignment is five separate facts, and a sentence made them compete.
   */
  rows?: ToastRow[];
}

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /**
   * Optional second line. The toast renders `message` as the headline and
   * this beneath it in a quieter tone, which is what lets a notification say
   * WHAT happened without burying the subject in the same sentence.
   * Optional so the ~55 existing two-argument call sites are unaffected.
   */
  detail?: string;
  rows?: ToastRow[];
}

export interface NotificationHistoryEntry extends Toast {
  at: number;
  read: boolean;
}

interface NotificationState {
  toasts: Toast[];
  history: NotificationHistoryEntry[];
  pushToast: (kind: ToastKind, message: string, options?: ToastOptions) => void;
  dismissToast: (id: string) => void;
  /** Clears every visible toast. History is untouched - the bell keeps them. */
  dismissAllToasts: () => void;
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
  pushToast: (kind, message, options) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const entry = { id, kind, message, detail: options?.detail, rows: options?.rows };
      return {
        toasts: [...state.toasts, entry],
        history: [{ ...entry, at: Date.now(), read: false }, ...state.history].slice(0, HISTORY_LIMIT),
      };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  dismissAllToasts: () => set({ toasts: [] }),
  markAllRead: () => set((state) => ({ history: state.history.map((h) => ({ ...h, read: true })) })),
}));
