import type { RefObject } from 'react';
import { Button } from '../../primitives/Button';
import { Icon } from '../../primitives/Icon';
import { Tooltip } from '../../primitives/Tooltip';
import type { WizardStep } from './guidedWizardTypes';

const EYE_ICON = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

export function WizardStepHeader({
  currentStep,
  allowCustomerView,
  viewOpen,
  toggleCustomerView,
  stepHeadingRef,
  values,
  setValue,
}: {
  currentStep: WizardStep | undefined;
  allowCustomerView: boolean | undefined;
  viewOpen: boolean;
  toggleCustomerView: () => void;
  stepHeadingRef: RefObject<HTMLHeadingElement | null>;
  /** For the step's own header action, when it has one. */
  values?: Record<string, unknown>;
  setValue?: (field: string, value: unknown) => void;
}) {
  const showCustomerView = allowCustomerView && !currentStep?.hideCustomerView;
  const action = currentStep?.headerAction && values && setValue ? currentStep.headerAction({ values, setValue }) : null;
  // Title left; Customer view floats at the right (see below) and the title row leaves room for it.
  return (
    <>
      {/* Floats: a zero-height sticky strip at the top of the step panel, so Customer view (and the step's own header action)
          stay in reach however far the agent scrolls. It sits at the title row when the panel is at the top, inset from the top by the same 24px as from the right
          (items-start: the button hangs from the strip instead of being centred on its zero height). */}
      {(showCustomerView || action) && (
        <div className="pointer-events-none sticky top-6 z-[var(--z-raised)] flex h-0 items-start justify-end">
          <div className="pointer-events-auto flex items-center gap-3">
              {action}
              {/* Says which content the customer can see; the container's outline says where it ends. */}
              {showCustomerView && viewOpen && (
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-warm px-2.5 py-0.5 text-accent text-[length:var(--fs-tag)] font-medium">
                  <Icon path={EYE_ICON} className="w-3.5 h-3.5" />
                  Visible to customer
                </span>
              )}
              {showCustomerView && (
              <Tooltip
                content={viewOpen ? 'The customer can see this section. Click to stop sharing.' : 'Show this section to the customer'}
                placement="bottom"
              >
                <Button
                  variant={viewOpen ? 'primary' : 'secondary'}
                  compact
                  onClick={toggleCustomerView}
                  aria-pressed={viewOpen}
                  className={viewOpen ? '' : '!border-transparent !shadow-none !bg-[var(--customer-view-bg)] !text-[var(--customer-view-fg)] enabled:hover:!bg-[var(--customer-view-bg-hover)]'}
                >
                  {viewOpen && (
                    <span aria-hidden="true" className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-[var(--radius-pill)] bg-accent-on opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-[var(--radius-pill)] bg-accent-on" />
                    </span>
                  )}
                  <Icon path={EYE_ICON} className="w-4 h-4" />
                  {viewOpen ? 'Showing to customer' : 'Customer view'}
                </Button>
              </Tooltip>
              )}
            </div>
        </div>
      )}
        <div className={`flex min-h-[39px] flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4 ${showCustomerView || action ? 'sm:pr-48' : ''}`}>
          <div>
            {currentStep?.eyebrow && (
              <p className="text-[var(--tint-teal-fg)] text-[length:var(--fs-tag)] font-semibold uppercase tracking-wide mb-1">{currentStep.eyebrow}</p>
            )}
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-[length:var(--fs-h4)] font-bold text-fg focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {currentStep?.heading ?? currentStep?.label}
            </h2>
            {currentStep?.subheading && (
              <p className="text-fg-2 text-[length:var(--fs-body)] mt-1">{currentStep.subheading}</p>
            )}
          </div>
        </div>
    </>
  );
}
