import { useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../../engines/configEngine';

const OPTIONS = [
  {
    type: 'postpaid',
    title: 'Postpaid Port-In',
    description: 'Port an existing number onto a Vodafone postpaid plan - billing profile, bill limit and credit checks apply.',
  },
  {
    type: 'prepaid',
    title: 'Prepaid Port-In',
    description: 'Port an existing number onto a Vodafone prepaid pack - balance-based, no billing profile or bill limit.',
  },
] as const;

// SCR-120: MNP Guided Process - Choose process - module-hierarchy.json's
// "MNP guided process presents Postpaid/Prepaid choice before data entry"
// capability. Both options lead into the same guided wizard (SCR-121 etc.,
// NewMnpWizard) via a `type` query param the wizard branches its step list
// and submission logic on, rather than forking into two separate wizards -
// VAL-332–335's Donor Details fields are explicitly evidenced as shared
// across "Postpaid/Prepaid MNP journeys," confirming this is one guided
// process with a choice gate, not two.
export function MnpProcessChoiceScreen() {
  const navigate = useNavigate();

  const choose = (type: (typeof OPTIONS)[number]['type']) => {
    const route = getAllRoutes().find((r) => r.screenId === 'SCR-121');
    if (!route) return;
    navigate(`${route.path}?type=${type}`);
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">MNP Port-In</h1>
      <p className="text-fg-2 mb-6">Choose the subscription type being ported in before starting the guided process.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => choose(opt.type)}
            className="text-left rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 hover:border-accent hover:shadow-raised transition-all"
          >
            <div className="font-medium text-fg text-[length:var(--fs-body-lg)] mb-1">{opt.title}</div>
            <p className="text-fg-2 text-[length:var(--fs-body)]">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
