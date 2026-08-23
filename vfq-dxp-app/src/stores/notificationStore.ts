import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface NotificationState {
  toasts: Toast[];
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;
}

// In-memory only per frontend-architecture.md §4 — toasts don't survive reload.
export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  pushToast: (kind, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind, message }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
