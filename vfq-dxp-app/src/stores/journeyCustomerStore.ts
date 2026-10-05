import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// The customer a journey is being run for, held from the moment they are identified until the
// journey is explicitly ended. Nothing else may replace it while it is held:
//   - Close Activity on the Activity Final page
//   - Save & Exit
//   - Abandon Order
//   - the session ending (sign-out; the store lives in sessionStorage, so closing the tab too)
// Every record the journey writes (draft order, order, activity, lead) takes its customer from
// here, so they all name the same person.

export interface ActiveCustomer {
  /** The wizard (draft) this context belongs to. */
  wizardId: string;
  /** Where that journey lives, so another entry point can be sent back to it. */
  path: string;
  journey: string;
  customerName: string;
  idNumber: string;
  /** Known once the eligibility check has resolved the customer record. */
  customerId?: string;
  startedAt: string;
  /** Set once the order is submitted: the Activity Final page can then be shown again until it is closed. */
  finalOrder?: Record<string, unknown>;
}

interface ActiveCustomerState {
  active: ActiveCustomer | null;
  /** Starts the context. A no-op while one is already held - the customer can never be switched. */
  begin: (c: ActiveCustomer) => void;
  /** Fills in details learned later (customer id, final order) without changing who the customer is. */
  patch: (wizardId: string, patch: Partial<Pick<ActiveCustomer, 'customerId' | 'finalOrder'>>) => void;
  /** Ends the context. With a wizardId, only if that journey owns it. */
  end: (wizardId?: string) => void;
}

export const useJourneyCustomer = create<ActiveCustomerState>()(
  persist(
    (set, get) => ({
      active: null,
      begin: (c) => {
        if (!get().active) set({ active: c });
      },
      patch: (wizardId, p) => {
        const a = get().active;
        if (!a || a.wizardId !== wizardId) return;
        // No-op when nothing changes: callers patch from effects, and a fresh object every call
        // would re-trigger them forever.
        const changed = (Object.keys(p) as (keyof typeof p)[]).some((k) => p[k] !== undefined && a[k] !== p[k]);
        if (changed) set({ active: { ...a, ...p } });
      },
      end: (wizardId) => {
        const a = get().active;
        if (a && (!wizardId || a.wizardId === wizardId)) set({ active: null });
      },
    }),
    { name: 'vfq-journey-customer', storage: createJSONStorage(() => sessionStorage) }
  )
);
