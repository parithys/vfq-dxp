// The Mobile and Fibre & Home product-line journey catalogue: what an agent can
// actually DO to a service, grouped the way the business talks about it rather
// than the way the screens happen to be implemented.
//
// Each product line renders one page (ProductLinePage) with a pill row for its
// categories; a category route shows just that section, "All" stacks them.
//
// Two fields decide what a role sees, and they are deliberately separate:
//
//   featureKey  Visibility. The card renders only if the role holds a grant for
//               this key in personas.json. Absent = a roadmap-only journey with
//               no catalogue entry yet; those render for any role that already
//               holds at least one journey in the same category, so the roadmap
//               stays visible without leaking irrelevant journeys to unrelated
//               roles (a Field Engineer should not be shown "Change Postpaid
//               Plan" just because it is unbuilt).
//
//   status      Product judgement, authored - NOT derived from built-ness.
//               'available' means the journey has a working end-to-end entry
//               point; 'partly' means only part of it is reachable (e.g. the
//               SIM swap QUEUE exists but the replacement journey does not);
//               'planned' means none of it is. Deriving this from
//               registerScreen() alone would over-promise: numbers.management-
//               portal is built, but that does not make "Special / Gold Number"
//               a finished journey. validateJourneyCatalogue() guards the one
//               thing that must hold - an 'available' journey must resolve to a
//               screen that is actually registered.

export type JourneyStatus = 'available' | 'partly' | 'planned';

export interface Journey {
  id: string;
  title: string;
  description: string;
  status: JourneyStatus;
  /** Gates visibility against personas.json grants. */
  featureKey?: string;
  /** Entry point. screenId is resolved to a path via routes.json. */
  screenId?: string;
  path?: string;
}

export interface JourneyCategory {
  key: string;
  /** Pill label - deliberately shorter than the section heading. */
  label: string;
  heading: string;
  description: string;
  icon: string;
  journeys: Journey[];
}

export interface ProductLine {
  key: 'mobile' | 'fibre-home';
  label: string;
  to: string;
  categories: JourneyCategory[];
}

const CAT_ICONS = {
  newConnection: 'M12 5v14 M5 12h14',
  existingService: 'M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8.5-6 M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8.5 6 M21 3v6h-6 M3 21v-6h6',
  numberServices: 'M9 3L7 21 M17 3l-2 18 M3.5 8.5h17 M3 15.5h17',
  simDevice: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 9h6v6H9z M2 9h2 M2 15h2 M20 9h2 M20 15h2',
  customerOwnership: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 11l2 2 4-4',
  relocation: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  equipment: 'M14.7 6.3a4 4 0 0 1 5 5L21 12l-9 9-3-3 9-9z M7 17l-3 3 M4.5 13.5l6 6',
  support: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z M20 14a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z M18 16v1a3 3 0 0 1-3 3h-3',
};

export const PRODUCT_LINES: readonly ProductLine[] = [
  {
    key: 'mobile',
    label: 'Mobile',
    to: '/mobile',
    categories: [
      {
        key: 'new-connections',
        label: 'New Connections',
        heading: 'New Connections',
        description: 'Activate new mobile lines, SIMs, and numbers for postpaid and prepaid customers.',
        icon: CAT_ICONS.newConnection,
        journeys: [
          { id: 'mob-new-postpaid', title: 'New Postpaid Connection', description: 'Activate a new postpaid line with plan and SIM', status: 'available', featureKey: 'postpaid.new-postpaid-wizard', screenId: 'SCR-037' },
          { id: 'mob-new-prepaid', title: 'New Prepaid Connection', description: 'Activate a new prepaid SIM and starter bundle', status: 'available', featureKey: 'prepaid.new-prepaid-tablet-wizard', screenId: 'SCR-190' },
          { id: 'mob-portin-new', title: 'Port-In as New Connection', description: 'Bring a number from another operator (MNP)', status: 'available', featureKey: 'mnp.port-in-wizard', screenId: 'SCR-121' },
          { id: 'mob-esim-activation', title: 'eSIM Activation', description: 'Provision an eSIM for a compatible device', status: 'planned' },
          { id: 'mob-add-line', title: 'Add a New Line', description: 'Add an additional line to an existing account', status: 'planned' },
          { id: 'mob-number-selection', title: 'New Number Selection', description: 'Reserve and assign a preferred number', status: 'partly', featureKey: 'numbers.management-portal', screenId: 'SCR-024' },
        ],
      },
      {
        key: 'existing-service',
        label: 'Existing Service',
        heading: 'Existing Service Management',
        description: 'Manage and modify active postpaid and prepaid mobile services.',
        icon: CAT_ICONS.existingService,
        journeys: [
          { id: 'mob-view-service', title: 'View Mobile Service', description: 'View account, usage, and service details', status: 'available', featureKey: 'workspace.customer360-view', path: '/customer-search' },
          { id: 'mob-change-postpaid-plan', title: 'Change Postpaid Plan', description: 'Move a customer to a different postpaid plan', status: 'planned' },
          { id: 'mob-change-prepaid-pack', title: 'Change Prepaid Pack', description: 'Change a prepaid bundle or top-up', status: 'planned' },
          { id: 'mob-add-addon', title: 'Add Add-On', description: 'Add a roaming, data, or IDD add-on', status: 'planned' },
          { id: 'mob-suspend', title: 'Suspend Service', description: 'Temporarily suspend a mobile line', status: 'planned' },
          { id: 'mob-resume', title: 'Resume Service', description: 'Reactivate a suspended mobile line', status: 'planned' },
          { id: 'mob-terminate', title: 'Terminate Service', description: 'Close and terminate a mobile contract', status: 'planned' },
        ],
      },
      {
        key: 'number-services',
        label: 'Number Services',
        heading: 'Number Services',
        description: 'Port, change, reserve, or manage mobile numbers.',
        icon: CAT_ICONS.numberServices,
        journeys: [
          { id: 'mob-mnp-portin', title: 'MNP Port-In', description: 'Port a number from another Qatari operator', status: 'available', featureKey: 'mnp.process-choice', screenId: 'SCR-120' },
          { id: 'mob-fnp-change', title: 'FNP Number Change', description: 'Change to a number within Vodafone Qatar', status: 'available', featureKey: 'mnp.port-in-wizard', screenId: 'SCR-121' },
          { id: 'mob-number-reservation', title: 'Number Reservation', description: 'Reserve a standard or preferred number', status: 'partly', featureKey: 'numbers.management-portal', screenId: 'SCR-024' },
          { id: 'mob-gold-number', title: 'Special / Gold Number', description: 'Select and assign a premium or gold number', status: 'partly', featureKey: 'numbers.management-portal', screenId: 'SCR-024' },
        ],
      },
      {
        key: 'sim-device',
        label: 'SIM & Device',
        heading: 'SIM & Device Services',
        description: 'Manage SIM replacements, swaps, eSIM conversions, and device upgrades.',
        icon: CAT_ICONS.simDevice,
        journeys: [
          { id: 'mob-sim-replacement', title: 'SIM Replacement', description: 'Replace a lost, damaged, or expired SIM', status: 'partly', featureKey: 'numbers.sim-swap-queue', screenId: 'SCR-196' },
          { id: 'mob-sim-swap', title: 'SIM Swap', description: 'Transfer a number to a new SIM card', status: 'partly', featureKey: 'numbers.sim-swap-queue', screenId: 'SCR-196' },
          { id: 'mob-phys-to-esim', title: 'Physical SIM to eSIM', description: 'Convert a physical SIM to an eSIM profile', status: 'planned' },
          { id: 'mob-esim-to-phys', title: 'eSIM to Physical SIM', description: 'Revert an eSIM to a physical SIM card', status: 'planned' },
          { id: 'mob-device-upgrade', title: 'Device Upgrade', description: 'Upgrade a bundled handset on an active contract', status: 'planned' },
        ],
      },
      {
        key: 'support',
        label: 'Support',
        heading: 'Customer & Ownership Services',
        description: 'Update customer details, validate identity, and manage service ownership.',
        icon: CAT_ICONS.customerOwnership,
        journeys: [
          { id: 'mob-customer-validation', title: 'Customer Validation', description: "Validate a customer's identity and QID", status: 'available', featureKey: 'identity.passport-to-qid', screenId: 'SCR-151' },
          { id: 'mob-contact-update', title: 'Contact Information Update', description: 'Update email, address, or phone details', status: 'partly', featureKey: 'workspace.customer360-view', path: '/customer-search' },
          { id: 'mob-ownership-change', title: 'Ownership Change', description: 'Transfer service ownership to another person', status: 'planned', featureKey: 'numbers.ton-wizard', screenId: 'SCR-035' },
          { id: 'mob-authorised-rep', title: 'Authorised Representative', description: 'Add or manage an authorised representative', status: 'planned' },
        ],
      },
    ],
  },
  {
    key: 'fibre-home',
    label: 'Fibre & Home',
    to: '/fibre-home',
    categories: [
      {
        key: 'new-connections',
        label: 'New Connections',
        heading: 'New Connections',
        description: 'Activate new fibre, fixed line, FWA, 5G Home, and IPTV services.',
        icon: CAT_ICONS.newConnection,
        journeys: [
          { id: 'fib-new-fibre', title: 'New Fibre Connection', description: 'Activate a new fibre broadband service', status: 'available', featureKey: 'fixedline.new-fixed-line-wizard', screenId: 'SCR-043' },
          { id: 'fib-new-fixed-line', title: 'New Fixed-Line Connection', description: 'Activate a new fixed telephone line', status: 'available', featureKey: 'fixedline.new-fixed-line-wizard', screenId: 'SCR-043' },
          { id: 'fib-new-fwa', title: 'New FWA Connection', description: 'Activate a new Fixed Wireless Access service', status: 'available', featureKey: 'fwa.new-fwa-wizard', screenId: 'SCR-077' },
          { id: 'fib-new-5g-home', title: 'New 5G Home Connection', description: 'Activate a new 5G home broadband service', status: 'available', featureKey: 'fwa.new-fwa-wizard', screenId: 'SCR-077' },
          { id: 'fib-new-iptv', title: 'New IPTV Service', description: 'Add an IPTV subscription to a fibre account', status: 'planned' },
        ],
      },
      {
        key: 'existing-service',
        label: 'Existing Service',
        heading: 'Existing Service Management',
        description: 'Manage, modify, or view active fibre and home services.',
        icon: CAT_ICONS.existingService,
        journeys: [
          { id: 'fib-view-service', title: 'View Existing Service', description: 'View account details, usage, and plan', status: 'available', featureKey: 'workspace.customer360-view', path: '/customer-search' },
          { id: 'fib-fwa-5g-service', title: 'FWA / 5G Service', description: 'Manage FWA and 5G home services', status: 'available', featureKey: 'fwa.serial-number-check', screenId: 'SCR-093' },
          { id: 'fib-change-plan', title: 'Change Plan', description: 'Move a customer to a different plan tier', status: 'planned' },
          { id: 'fib-upgrade', title: 'Upgrade Service', description: 'Upgrade speed tier or service type', status: 'planned' },
          { id: 'fib-suspend', title: 'Suspend Service', description: 'Temporarily suspend a fixed service', status: 'planned' },
          { id: 'fib-resume', title: 'Resume Service', description: 'Reactivate a suspended fixed service', status: 'planned' },
          { id: 'fib-terminate', title: 'Terminate Service', description: 'Close and terminate a fixed contract', status: 'planned' },
        ],
      },
      {
        key: 'relocation',
        label: 'Relocation',
        heading: 'Relocation & Address Services',
        description: 'Manage home moves, service relocations, coverage checks, and address changes.',
        icon: CAT_ICONS.relocation,
        journeys: [
          { id: 'fib-coverage-check', title: 'Coverage Check', description: 'Check fibre or FWA availability at an address', status: 'partly', featureKey: 'fixedline.new-fixed-line-wizard', screenId: 'SCR-043' },
          { id: 'fib-relocate', title: 'Relocate Fibre Service', description: 'Move an active fibre service to a new address', status: 'planned' },
          { id: 'fib-home-move', title: 'Home Move', description: 'Coordinate a full home move with service transfer', status: 'planned', featureKey: 'fwa.appointment-booking', screenId: 'SCR-115' },
          { id: 'fib-change-install-address', title: 'Change Installation Address', description: 'Update the registered installation address', status: 'planned' },
          { id: 'fib-install-appointment', title: 'Installation Appointment', description: 'Schedule or reschedule a field installation', status: 'planned', featureKey: 'fwa.appointment-booking', screenId: 'SCR-109' },
        ],
      },
      {
        key: 'equipment',
        label: 'Equipment',
        heading: 'Equipment & Installation',
        description: 'Track installations, manage routers, and handle equipment replacement.',
        icon: CAT_ICONS.equipment,
        journeys: [
          { id: 'fib-router-mgmt', title: 'Router Management', description: 'View router details and perform a remote reset', status: 'planned' },
          { id: 'fib-equip-replacement', title: 'Equipment Replacement', description: 'Replace a faulty or damaged CPE device', status: 'planned' },
          { id: 'fib-device-return', title: 'Device Return', description: 'Initiate a CPE return on contract termination', status: 'planned' },
          { id: 'fib-iptv-equipment', title: 'IPTV Equipment', description: 'Manage set-top boxes and IPTV hardware', status: 'planned' },
        ],
      },
      {
        key: 'support',
        label: 'Support',
        heading: 'Fibre & Home Support',
        description: 'Create and track tickets, fault reports, and installation complaints.',
        icon: CAT_ICONS.support,
        journeys: [
          { id: 'fib-create-ticket', title: 'Create Ticket', description: 'Raise a new support or fault ticket', status: 'available', featureKey: 'tickets.dashboard', screenId: 'SCR-211' },
          { id: 'fib-track-ticket', title: 'Track Ticket', description: 'Find and review an existing ticket', status: 'available', featureKey: 'tickets.detail-view', screenId: 'SCR-029' },
          { id: 'fib-connectivity-issue', title: 'Report Connectivity Issue', description: 'Log a broadband or voice connectivity fault', status: 'available', featureKey: 'tickets.dashboard', screenId: 'SCR-211' },
          { id: 'fib-complaint', title: 'Complaint', description: 'Log a formal customer complaint', status: 'available', featureKey: 'tickets.dashboard', screenId: 'SCR-211' },
          { id: 'fib-install-issue', title: 'Report Installation Issue', description: 'Escalate a problem with a field installation', status: 'planned' },
          { id: 'fib-escalation', title: 'Escalation', description: 'Escalate an unresolved ticket to a senior team', status: 'planned' },
        ],
      },
    ],
  },
];

export const PRODUCT_LINE_BY_KEY = new Map(PRODUCT_LINES.map((l) => [l.key, l]));

/** Journeys in this category visible to a role, given a grant predicate.
 *
 * Takes the predicate rather than importing personaEngine so this file stays
 * pure data + selectors, and so both the sidebar (navigationEngine) and the
 * page (ProductLinePage) filter through exactly the same rule. They diverged
 * once - the page hid empty categories while the rail still listed all five,
 * so a role could click a sub-menu item and land on someone else's content. */
export function visibleJourneys(
  category: JourneyCategory,
  canUse: (featureKey: string) => boolean
): Journey[] {
  const gated = category.journeys.filter((j) => j.featureKey);
  // A category whose every journey is roadmap-only (Equipment & Installation
  // today) has nothing to gate on. Returning [] there hid the whole category
  // from every role, which is wrong: it is a real part of the IA that simply
  // isn't built yet, and the roadmap rule below already says such journeys
  // should stay visible.
  if (gated.length === 0) return category.journeys;
  const granted = gated.filter((j) => canUse(j.featureKey!));
  if (granted.length === 0) return [];
  // Roadmap-only journeys (no featureKey) ride along with the category.
  return category.journeys.filter((j) => !j.featureKey || granted.includes(j));
}

/** Categories in this line the role can reach.
 *
 * A gated category needs at least one granted journey. A roadmap-only category
 * rides along with the line - the same rule as a roadmap journey within a
 * category, one level up - but only if the role reaches the line at all, so a
 * role with no business in Mobile doesn't inherit Mobile's roadmap. */
export function reachableCategories(
  lineKey: ProductLine['key'],
  canUse: (featureKey: string) => boolean
): JourneyCategory[] {
  const line = PRODUCT_LINE_BY_KEY.get(lineKey);
  if (!line) return [];
  const isGated = (c: JourneyCategory) => c.journeys.some((j) => j.featureKey);
  const reachableGated = line.categories.filter((c) => isGated(c) && visibleJourneys(c, canUse).length > 0);
  if (reachableGated.length === 0) return [];
  return line.categories.filter((c) => reachableGated.includes(c) || !isGated(c));
}
