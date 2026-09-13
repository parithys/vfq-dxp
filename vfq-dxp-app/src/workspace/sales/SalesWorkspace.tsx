import { useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../engines/configEngine';
import { LeadListView } from '../../modules/lead-management/LeadListView';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';

// Resolved by screenId, not a hardcoded path — SCR-037 is filed under the
// sim-number-management module route in routes.json despite being the
// Mobile Postpaid wizard, so looking it up avoids baking in that quirk.
//
// Every genuinely blank-start "new customer" wizard belongs here (none of
// these read activeCustomerStore) — Prepaid and MNP Port-In were previously
// missing even though both are fully built. Pre-to-Post Migration and SIM
// Swap are deliberately NOT included: both act on a line/service the
// customer already has, so they're Customer 360 product actions, not new
// acquisitions.
const ACQUISITION_ACTIONS = [
  { label: 'New Postpaid Connection', screenId: 'SCR-037' },
  { label: 'New Prepaid Connection', screenId: 'SCR-190' },
  { label: 'New Fixed Line', screenId: 'SCR-043' },
  { label: 'New FWA / 5G Home', screenId: 'SCR-077' },
  // SCR-120, not SCR-121 — the wizard itself now requires a Postpaid/Prepaid
  // choice (module-hierarchy.json's "MNP guided process presents Postpaid/
  // Prepaid choice before data entry") before it'll accept data entry.
  { label: 'MNP Port-In', screenId: 'SCR-120' },
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
