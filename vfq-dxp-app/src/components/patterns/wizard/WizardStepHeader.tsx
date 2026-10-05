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
}: {
  currentStep: WizardStep | undefined;
  allowCustomerView: boolean | undefined;
  viewOpen: boolean;
  toggleCustomerView: () => void;
  stepHeadingRef: RefObject<HTMLHeadingElement | null>;
}) {
  // Title left, Customer view right and vertically centred with it; the button wraps below the title when the row is too narrow.
  return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
          <div>
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
          {allowCustomerView && !currentStep?.hideCustomerView && (
            <div className="flex items-center gap-3">
              {/* Says which content the customer can see; the container's outline says where it ends. */}
              {viewOpen && (
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-warm px-2.5 py-0.5 text-accent text-[length:var(--fs-tag)] font-medium">
                  <Icon path={EYE_ICON} className="w-3.5 h-3.5" />
                  Visible to customer
                </span>
              )}
              <Tooltip
                content={viewOpen ? 'The customer can see this section. Click to stop sharing.' : 'Show this section to the customer'}
                placement="bottom"
              >
                <Button variant={viewOpen ? 'primary-rect' : 'secondary-rect'} compact onClick={toggleCustomerView} aria-pressed={viewOpen}>
                  {viewOpen && (
                    <span aria-hidden="true" className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                  )}
                  <Icon path={EYE_ICON} className="w-4 h-4" />
                  {viewOpen ? 'Showing to customer' : 'Customer view'}
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
  );
}
