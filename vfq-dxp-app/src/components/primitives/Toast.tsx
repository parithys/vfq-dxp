import { Fragment, useEffect, useRef } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import type { ToastKind, ToastRow } from '../../stores/notificationStore';
import { Icon } from './Icon';

const CLOSE_ICON = 'M18 6L6 18 M6 6l12 12';

// Value colour per row tone, lifted toward white because the surface is dark
// in BOTH themes: the base tokens are tuned for light backgrounds, and the
// brightened dark-mode values only apply under .dark, which does not help a
// dark toast sitting in the light theme.
//
// 'id' borrows --field-calendar-range, the only cyan already in the palette,
// so a reference number reads as a distinct class of value from a status
// without introducing a new hue. Lifted 45% to land on the mint the reference
// uses rather than the saturated cyan the raw token gives.
const rowToneClass: Record<NonNullable<ToastRow['tone']>, string> = {
  default: 'text-white',
  id: 'text-[color-mix(in_oklab,var(--field-calendar-range),white_45%)]',
  success: 'text-[color-mix(in_oklab,var(--success),white_35%)]',
};

const dotColour: Record<ToastKind, string> = {
  success: 'color-mix(in oklab, var(--success), white 30%)',
  error: 'color-mix(in oklab, var(--danger), white 30%)',
  warning: 'color-mix(in oklab, var(--warn), white 15%)',
  info: 'rgba(255,255,255,.55)',
};

// Toast/Alert/ConfirmDialog per notification-catalogue.md section 4's evidenced
// taxonomy. Error toasts use role="alert" (implicitly assertive) so screen
// readers interrupt for failures; success/info/warning use role="status"
// (polite) so they're announced without stealing focus from whatever the user
// was doing.
//
// The card is a dark --charcoal-panel surface in both themes. A toast is
// transient and overlays whatever the agent is reading, so an inverted surface
// separates it from the page without leaning on the elevation the rest of the
// re-skin removed - and it looks the same in dark mode instead of inverting
// along with the page underneath it.
//
// STRUCTURE, for the structured variant. Header band, full-bleed rule, body:
// three stacked blocks, NOT a flex row with the rule nested inside a content
// column. The dot and the title are inside the header's own padding, so the
// rule can span the card edge to edge. Nesting it beside the dot - which is
// what this did first - insets the rule by the dot's width plus its gap, and
// no amount of padding tuning fixes that because the rule is simply in the
// wrong box.
//
// Type carries the hierarchy: the title is caption-sized, uppercase and
// tracked; labels are caption-sized and dimmed; VALUES are body-sized and
// semibold. Rendering labels and values at one size, which this also did
// first, leaves the agent no way to scan values without reading labels too.
export function ToastContainer() {
  const { toasts, dismissToast, dismissAllToasts } = useNotificationStore();
  const stackRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere off the stack clears it.
  //
  // Attached on a deferred tick, NOT synchronously: almost every toast in this
  // app is pushed BY a click (Next Customer, Finish, Save), and that same
  // click is still propagating when this effect runs. Listening immediately
  // would let the originating click dismiss the toast it just created, so the
  // notification would never be readable.
  //
  // pointerdown rather than click, so the dismissal happens as the agent
  // starts interacting elsewhere instead of waiting for mouseup, and it still
  // fires for touch.
  //
  // Escape is bound too. Without it this feature would be mouse-only: there is
  // no keyboard equivalent of "click outside", so a keyboard user would be
  // left with only the per-toast dismiss button while everyone else got a
  // one-gesture clear.
  useEffect(() => {
    if (!toasts.length) return;
    let armed = false;
    const arm = setTimeout(() => {
      armed = true;
    }, 0);
    const onPointerDown = (e: PointerEvent) => {
      if (!armed) return;
      if (stackRef.current?.contains(e.target as Node)) return;
      dismissAllToasts();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAllToasts();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toasts.length, dismissAllToasts]);

  if (!toasts.length) return null;
  return (
    // Bottom centre. items-center with no fixed stack width, because a
    // structured card needs room for five columns while a one-line card should
    // stay narrow - each card sets its own max-width and they centre
    // independently rather than all stretching to the widest one.
    //
    // pointer-events-none on the stack keeps the wide footprint from
    // swallowing clicks on the page behind it; only the cards take pointer
    // events back.
    <div
      ref={stackRef}
      className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
    >
      {toasts.map((t) => {
        const structured = Boolean(t.rows?.length);
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--charcoal-panel)] shadow-raised ${
              structured ? 'max-w-[60rem]' : 'max-w-[34rem]'
            }`}
          >
            {structured ? (
              <>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColour[t.kind] }}
                      aria-hidden="true"
                    />
                    <span className="text-white font-semibold text-[length:var(--fs-caption)] uppercase tracking-[0.12em] truncate">
                      {t.message}
                    </span>
                  </span>
                  <button
                    onClick={() => dismissToast(t.id)}
                    aria-label="Dismiss notification"
                    className="text-white/45 hover:text-white shrink-0"
                  >
                    <Icon path={CLOSE_ICON} className="w-5 h-5" />
                  </button>
                </div>

                {/* Full-bleed: a sibling of the header, not a child of it. */}
                <div className="border-t border-white/10" />

                <div className="px-5 py-4">
                  {/* Two rows, one column per field. grid-rows-2 with
                      grid-flow-col puts each dt on the top row and its dd
                      directly beneath, while keeping dt/dd adjacent in the DOM
                      so the list stays semantically paired for a screen
                      reader. Five stacked label+value divs would look
                      identical only while every label fits on one line - the
                      moment one wraps, the value baselines stop aligning.

                      grid-rows-[auto_auto], NOT Tailwind's grid-rows-2: that
                      utility is repeat(2, minmax(0,1fr)), which forces both
                      rows to the SAME height. With two values wrapping to two
                      lines that made the label row 44px tall for a 19px line,
                      which reads as phantom padding under every label and is
                      not removable by touching padding, because there is
                      none - the dt has padding 0. Auto rows size to their own
                      content. */}
                  <dl className="grid grid-rows-[auto_auto] grid-flow-col auto-cols-fr gap-x-6 gap-y-1.5">
                    {t.rows!.map((row) => (
                      <Fragment key={row.label}>
                        <dt className="text-white/50 text-[length:var(--fs-caption)] leading-snug">{row.label}</dt>
                        <dd
                          className={`text-[length:var(--fs-body)] font-semibold leading-snug ${rowToneClass[row.tone ?? 'default']}`}
                        >
                          {row.value}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2.5 px-3.5 py-3">
                <span
                  className="mt-[0.3rem] w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dotColour[t.kind] }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-[length:var(--fs-caption)] leading-snug">{t.message}</p>
                  {t.detail && (
                    <p className="text-white/60 text-[length:var(--fs-caption)] leading-snug mt-0.5">{t.detail}</p>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss notification"
                  className="text-white/45 hover:text-white shrink-0"
                >
                  <Icon path={CLOSE_ICON} className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
