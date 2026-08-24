import { useNotificationStore } from '../../stores/notificationStore';
import type { ToastKind } from '../../stores/notificationStore';

const kindClasses: Record<ToastKind, string> = {
  success: 'border-success text-success',
  error: 'border-danger text-danger',
  warning: 'border-[var(--warn)] text-[var(--warn-text)]',
  info: 'border-border text-fg',
};

// Toast/Alert/ConfirmDialog per notification-catalogue.md §4's evidenced taxonomy.
// Error toasts use role="alert" (implicitly assertive) so screen readers
// interrupt for failures; success/info/warning use role="status" (polite) so
// they're announced without stealing focus from whatever the user was doing.
export function ToastContainer() {
  const { toasts, dismissToast } = useNotificationStore();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
          className={`rounded-[var(--radius-card)] border bg-bg shadow-raised px-4 py-3 text-[length:var(--fs-body)] flex items-start justify-between gap-3 ${kindClasses[t.kind]}`}
        >
          <span className="text-fg">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-muted hover:text-fg leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
