import type { ReactNode } from 'react';
import { Button } from '../../primitives/Button';

/** Title row (title + Save & Exit / Abandon Order), the fixed customer, and the pop-up-blocked notice. */
export function WizardTitleBand({
  title,
  titleAside,
  popupBlocked,
  onSaveExit,
  onAbandon,
  abandonHidden,
  onRequestSaveExit,
  onRequestAbandon,
}: {
  title: string;
  titleAside?: ReactNode;
  popupBlocked: boolean;
  onSaveExit: (() => void) | undefined;
  onAbandon: (() => void) | undefined;
  abandonHidden: boolean;
  onRequestSaveExit: () => void;
  onRequestAbandon: () => void;
}) {
  // Save & Exit and Abandon Order sit in the page's title row, at the right.
  const exitLinks = (
    <>
              {/* "Save & Exit" (2026-09-28) - distinct from Abandon: this
                  keeps the draft for later resumption rather than deleting
                  it. No confirmation modal, unlike Abandon - it is not
                  destructive, so it should not carry the same weight. Stays
                  available even once locked: a signed-but-unpaid order is
                  exactly the kind of thing an agent needs to be able to set
                  aside and come back to. */}
              {onSaveExit && (
                <Button
                  variant="secondary-rect"
                  compact
                  onClick={onRequestSaveExit}
                >
                  Save & Exit
                </Button>
              )}
              {/* "Abandon Order" - removed 2026-09-26, restored 2026-09-27 on
                  direction. A ghost (tertiary) button as of 2026-10-04, with Save & Exit as
                  the secondary button; neither is primary, so neither competes with Continue. Confirmed before it fires, because it discards
                  everything the agent has entered. Hidden from hideAbandonFrom
                  onward (2026-09-28) - see that prop's own note. */}
              {onAbandon && !abandonHidden && (
                <Button
                  variant="ghost-rect"
                  compact
                  onClick={onRequestAbandon}
                >
                  Abandon Order
                </Button>
              )}
    </>
  );

  // Title area: carries the page's own padding and a bottom border, so the step rail below it can sit flush against the left edge.
  return (
      <div className="px-8 pt-8 pb-6 bg-bg border-b border-[var(--field-card-border)]">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{title}</h1>
          <div className="flex items-center gap-3">
            {exitLinks}
          </div>
        </div>
        {/* The fixed customer for this journey sits under the title. */}
        {titleAside && <div>{titleAside}</div>}
        {popupBlocked && (
          <p role="alert" className="text-[var(--warn-text)] text-[length:var(--fs-caption)] mt-3">
            The browser blocked the customer view pop-up. Allow pop-ups for this site and try again.
          </p>
        )}
      </div>
  );
}
