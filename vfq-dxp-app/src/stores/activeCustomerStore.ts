import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveCustomerSummary {
  customerId: string;
  name: string;
  qid: string;
  idType: 'QID' | 'Passport';
  dob: string;
  nationality: string;
  email?: string;
  phone?: string;
  segment: string;
  blacklisted: boolean;
}

interface ActiveCustomerState {
  customer: ActiveCustomerSummary | null;
  recentCustomerIds: string[];
  setActiveCustomer: (customer: ActiveCustomerSummary) => void;
  clearActiveCustomer: () => void;
}

// The customer-context bridge the whole Customer 360 redesign hinges on: no
// prior mechanism existed to carry "this journey is for customer X" across a
// navigation boundary (every wizard always started from a blank contact
// step). Customer 360 calls setActiveCustomer() before launching an existing
// wizard; GuidedContactStep reads it to pre-fill instead of asking again.
// Also doubles as the data source for Dashboard's "recently viewed
// customers" - no separate history mechanism needed.
export const useActiveCustomerStore = create<ActiveCustomerState>()(
  persist(
    (set) => ({
      customer: null,
      recentCustomerIds: [],
      setActiveCustomer: (customer) =>
        set((state) => ({
          customer,
          recentCustomerIds: [customer.customerId, ...state.recentCustomerIds.filter((id) => id !== customer.customerId)].slice(0, 8),
        })),
      clearActiveCustomer: () => set({ customer: null }),
    }),
    { name: 'vfq-active-customer-store' }
  )
);
