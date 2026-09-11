import { useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../engines/configEngine';
import { LeadListView } from '../../modules/lead-management/LeadListView';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';

// Resolved by screenId, not a hardcoded path — SCR-037 is filed under the
// sim-number-management module route in routes.json despite being the
// Mobile Postpaid wizard, so looking it up avoids baking in that quirk.
const ACQUISITION_ACTIONS = [
  { label: 'New Postpaid Connection', screenId: 'SCR-037' },
  { label: 'New Fixed Line', screenId: 'SCR-043' },
  { label: 'New FWA / 5G Home', screenId: 'SCR-077' },
];

// Sales = the lead/prospect pipeline (wraps the existing Lead Management
// screens unchanged) plus the entry point for acquiring a customer who
// doesn't exist yet. Clears the active-customer bridge before launching
// acquisition — these wizards must start blank even if the agent was just
// looking at a different customer's Customer 360.
export function SalesWorkspace() {
  const navigate = useNavigate();
  const clearActiveCustomer = useActiveCustomerStore((s) => s.clearActiveCustomer);

  const startAcquisition = (screenId: string) => {
    const route = getAllRoutes().find((r) => r.screenId === screenId);
    if (!route) return;
    clearActiveCustomer();
    navigate(route.path);
  };

  return (
    <div>
      <div className="px-8 pt-8">
        <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">Start a new customer acquisition</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {ACQUISITION_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => startAcquisition(action.screenId)}
              className="rounded-[var(--radius-button)] border border-border px-4 py-2 text-[length:var(--fs-btn-compact)] text-fg hover:bg-surface hover:border-accent transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <LeadListView scope="all" />
    </div>
  );
}
