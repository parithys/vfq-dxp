import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityComments } from './ActivityComments';
import { ActivationComplete } from './ActivationComplete';
import { AddonsPicker } from './AddonsSelection';
import { CrossSalesStep } from './CrossSellOffers';
import { CustomerTypeStep } from './CustomerType';
import { EligibilityGateStep, OutcomeActions } from './EligibilityGate';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED } from './SelectableCard';
import { Drawer } from './SideDrawer';
import { useNotificationStore } from '../stores/notificationStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { GuidedActivationWizard } from './GuidedActivationWizard';
import { customerQualificationStep } from './CustomerQualification';
import { Input } from '../components/primitives/Input';
import type { WizardStep } from '../components/patterns/wizard/guidedWizardTypes';
import { Button } from '../components/primitives/Button';
import { SegmentedTabs } from '../components/primitives/SegmentedTabs';
import { AppointmentBooking } from './AppointmentBooking';
import { BillingAccount } from './BillingAccount';
import { CafSignature } from './CafSignature';
import { LineSelection } from './LineSelection';
import type { CustomerLine } from './LineSelection';
import { CheckoutSummary, PrepaidCheckout } from './CheckoutSummary';
import { CustomerIdentification } from './CustomerIdentification';
import { SpecialDiscountsIdentification } from './SpecialDiscountsIdentification';
import { NumberSelection } from './NumberSelection';
import { Payment } from './Payment';
import { PlanSelection } from './PlanSelection';
import { ServiceAddress } from './ServiceAddress';
import { SimType } from './SimType';

// Live previews for the Capability Library page: the REAL capability component with throwaway local state, so what
// the library shows is exactly what every journey renders - a change to the capability shows here and there.

function Identification() {
  const [v, setV] = useState({});
  // As the journeys use it: the first scan comes back unclear, and Retake gives the clear capture.
  return <CustomerIdentification value={v} onChange={setV} verifyThenFetch />;
}
function SpecialDiscountsId() {
  const [v, setV] = useState({});
  return <SpecialDiscountsIdentification value={v} onChange={setV} idNumber="28456701234" />;
}
function Number() {
  const [n, setN] = useState<string | undefined>();
  return <NumberSelection value={n} onChange={(m) => setN(m)} />;
}
function Billing() {
  const [v, setV] = useState({});
  return <BillingAccount customerId={undefined} defaultAddressLine={undefined} value={v} onChange={setV} customerName="Sample Customer" />;
}
function Address() {
  const [v, setV] = useState({});
  return <ServiceAddress mode="structured" value={v} onChange={setV} />;
}
// One sample per variant, as the journeys render them (a switcher picks which), so the library never shows a layout no page uses.
function Variants<K extends string>({ items, render }: { items: { key: K; label: string }[]; render: (key: K) => ReactNode }) {
  const [active, setActive] = useState<K>(items[0].key);
  return (
    <div className="space-y-4">
      <SegmentedTabs items={items} active={active} onChange={setActive} label="Variant" />
      <div key={active}>{render(active)}</div>
    </div>
  );
}
function PostpaidPlan({ mode }: { mode: 'plan' | 'extras' }) {
  const [p, setP] = useState<string | undefined>('PROD-107');
  const [d, setD] = useState<string | undefined>();
  const [a, setA] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | undefined>();
  const [supportingId, setSupportingId] = useState<string | undefined>();
  const [proof, setProof] = useState<{ fileName: string; sizeBytes: number } | undefined>();
  return (
    <PlanSelection
      kind="postpaid"
      mode={mode}
      customerContext={{}}
      customerBenefits={undefined}
      selectedProductId={p}
      onSelectProduct={setP}
      onDeselectProduct={() => setP(undefined)}
      discountId={d}
      onSelectDiscount={setD}
      addonIds={a}
      onAddonsChange={setA}
      billLimit={limit}
      onBillLimitChange={(amount) => setLimit(amount)}
      requiresHrnAdvance={false}
      discountSupportingId={supportingId}
      onDiscountSupportingIdChange={setSupportingId}
      discountProofDocument={proof}
      onDiscountProofDocumentChange={setProof}
    />
  );
}
function PrepaidPlan({ mode }: { mode: 'plan' | 'extras' }) {
  const [p, setP] = useState<string | undefined>();
  const [d, setD] = useState<string | undefined>();
  const [a, setA] = useState<string[]>([]);
  return <PlanSelection kind="prepaid" mode={mode} selectedProductId={p} onSelectProduct={setP} onDeselectProduct={() => setP(undefined)} discountId={d} onSelectDiscount={setD} addonIds={a} onSelectAddons={setA} />;
}
function FixedPlan() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return <PlanSelection kind="fixed" values={values} setValue={(field, value) => setValues((v) => ({ ...v, [field]: value }))} />;
}
function Plan() {
  return (
    <Variants
      items={[
        { key: 'postpaid', label: 'Postpaid plan' },
        { key: 'postpaid-extras', label: 'Postpaid add-ons' },
        { key: 'prepaid', label: 'Prepaid pack' },
        { key: 'prepaid-extras', label: 'Prepaid add-ons' },
        { key: 'fixed', label: 'Fixed / fibre' },
      ]}
      render={(k) =>
        k === 'postpaid' ? <PostpaidPlan mode="plan" /> : k === 'postpaid-extras' ? <PostpaidPlan mode="extras" /> : k === 'prepaid' ? <PrepaidPlan mode="plan" /> : k === 'prepaid-extras' ? <PrepaidPlan mode="extras" /> : <FixedPlan />
      }
    />
  );
}
const SAMPLE_ORDER_ROWS = [
  { label: 'Plan', value: 'Postpaid Essential' },
  { label: 'Monthly charge', value: 'QAR 200 / month' },
  { label: 'Due today', value: 'QAR 0' },
];
function Caf() {
  const [standard, setStandard] = useState({});
  const [full, setFull] = useState({});
  return (
    <Variants
      items={[
        { key: 'full', label: 'Full (postpaid journeys)' },
        { key: 'standard', label: 'Standard' },
      ]}
      render={(k) =>
        k === 'full' ? (
          <CafSignature variant="full" value={full} onChange={setFull} customerName="Sample Customer" orderSummary={SAMPLE_ORDER_ROWS} fullTerms legalFacts={{ hrnAdvanceQar: 0 }} />
        ) : (
          <CafSignature value={standard} onChange={setStandard} customerName="Sample Customer" />
        )
      }
    />
  );
}
const SAMPLE_ELIGIBILITY = {
  pass: true,
  hardStop: false,
  softStop: false,
  checks: [],
  blacklisted: false,
  lineCapExceeded: false,
  requiresHrnAdvance: false,
  defaultCreditLimitQar: 1000,
  customerId: 'CUST-1001',
  idNumber: '28456701234',
} as Parameters<typeof CheckoutSummary>[0]['eligibility'];
function Checkout() {
  return (
    <Variants
      items={[
        { key: 'postpaid', label: 'Postpaid read-back' },
        { key: 'prepaid', label: 'Prepaid cart' },
      ]}
      render={(k) =>
        k === 'postpaid' ? (
          // The same figures the journey's Checkout shows: a Star number over the plan's entitlement, the Red 350 promotion, an eSIM and
          // the default credit limit with the bill limit the agent set.
          <CheckoutSummary
            layout="detailed"
            customerName="Ahmed, Abdulla Hassan, Al-Sulaiti"
            altPhone={undefined}
            productId="PROD-104"
            discountId={undefined}
            addonIds={[]}
            msisdn="+97499990000"
            numberPriceQar={20000}
            eligibility={SAMPLE_ELIGIBILITY}
            billLimit={1000}
            simType={{ simType: 'eSIM', esimIssued: true }}
            onTotalsComputed={() => {}}
            onEdit={() => {}}
          />
        ) : (
          <PrepaidCheckout customerName="Sample Customer" idType="QID" lines={[]} onTotalsComputed={() => {}} onEdit={() => {}} />
        )
      }
    />
  );
}
function Pay() {
  const [v, setV] = useState({});
  // As the journeys mount it, including "Proceed without WinCash" (the agent took physical cash directly), which records the payment as cash.
  return <Payment amountDueQAR={11250} value={v} onChange={setV} onProceedWithout={() => setV({ paid: true, method: 'Cash', handoffStarted: false, declined: false })} />;
}
function Appointment() {
  const [v, setV] = useState({});
  return <AppointmentBooking value={v} onChange={setV} />;
}
function Activity() {
  const [c, setC] = useState('');
  const [ch, setCh] = useState('Appointment');
  return <ActivityComments value={c} onChange={setC} channel={{ value: ch, onChange: setCh, options: ['Appointment', 'Walk-in', 'Call Center'] }} />;
}

function Sim() {
  const [v, setV] = useState({});
  return <SimType value={v} onChange={setV} customerEmail="sample.customer@example.qa" />;
}


// Samples for the capabilities that were "needs a live order": each mounts the REAL capability with throwaway local state
// and test data (CUST-1001, PROD-107 ...), so a change to the capability shows here and in every journey.
function Addons() {
  const [ids, setIds] = useState<string[]>([]);
  return <AddonsPicker selectedIds={ids} onChange={setIds} layout="rows" eligibilityContext={{ planId: 'PROD-107' }} emptyMessage="No add-ons available for this plan" />;
}
function CustomerType() {
  const [v, setV] = useState<Parameters<typeof CustomerTypeStep>[0]['value']>({});
  return <CustomerTypeStep value={v} onChange={setV} idNumber="28456701234" />;
}
function CrossSell() {
  const [v, setV] = useState<Parameters<typeof CrossSalesStep>[0]['value']>({});
  return <CrossSalesStep customerId="CUST-1001" value={v} onChange={setV} onHandOff={() => {}} journey="new-postpaid" />;
}
// Each scenario is a test customer whose result is that outcome. The gate, the outcome the footer carries (Continue, Request
// Approval, Continue Prepaid / Proceed to Payment, Abandon Order) are the ones New Connection uses.
const ELIGIBILITY_SCENARIOS = [
  { key: 'clear', label: 'Clear', idNumber: '28456701234' },
  { key: 'approval', label: 'Approval routing', idNumber: 'P0998812' },
  { key: 'soft', label: 'Soft stop', idNumber: '29011122233' },
  { key: 'hard', label: 'Hard stop', idNumber: 'DIP-QA-004521' },
];
function EligibilityScenario({ idNumber }: { idNumber: string }) {
  const [r, setR] = useState<Parameters<typeof EligibilityGateStep>[0]['result']>(undefined);
  return (
    <div className="space-y-4">
      <EligibilityGateStep idNumber={idNumber} result={r} onResult={setR} announcePass={false} scope="product" />
      <div className="flex items-center justify-end gap-3 border-t border-border-soft pt-4">
        <OutcomeActions eligibility={r} onAbandon={() => {}} defaultButton={<Button variant="primary">Continue</Button>} />
      </div>
    </div>
  );
}
function Eligibility() {
  return (
    <Variants
      items={ELIGIBILITY_SCENARIOS.map((x) => ({ key: x.key, label: x.label }))}
      render={(k) => <EligibilityScenario idNumber={ELIGIBILITY_SCENARIOS.find((x) => x.key === k)!.idNumber} />}
    />
  );
}
function Cards() {
  const [on, setOn] = useState<'a' | 'b' | 'c'>('a');
  const card = (k: 'a' | 'b' | 'c', title: string, style: string, note: string) => (
    <button type="button" aria-pressed={on === k} onClick={() => setOn(k)} className={`rounded-[var(--radius-card)] border p-4 text-left ${on === k ? CARD_SELECTED : style}`}>
      <span className="block text-fg font-semibold">{title}</span>
      <span className="block text-fg-2 text-[length:var(--fs-caption)]">{note}</span>
    </button>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {card('a', 'Idle card', CARD_IDLE, 'Click to select - it takes the selected style.')}
      {card('b', 'Another idle card', CARD_IDLE, 'Only one is selected at a time.')}
      {card('c', 'Highlighted card', CARD_HIGHLIGHT, 'The app singles this one out (Popular, Recommended).')}
    </div>
  );
}
function DrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open sample drawer
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Sample drawer" footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
          </>
        }>
        <p className="text-fg-2 text-[length:var(--fs-body)]">Side drawer: reference material or a short form, read beside the page instead of covering it.</p>
      </Drawer>
    </>
  );
}
function ToastDemo() {
  const push = useNotificationStore((s) => s.pushToast);
  return (
    <div className="flex flex-wrap gap-2">
      {(['success', 'info', 'warning', 'error'] as const).map((k) => (
        <Button key={k} variant="secondary" onClick={() => push(k, `Sample ${k} notification`, { detail: 'Raised from the Capability Library.' })}>
          Show {k}
        </Button>
      ))}
    </div>
  );
}
// The real wizard shell on three sample steps (step list, running Summary panel, Back / Continue footer). Its draft is cleared on
// the way in and out, and leaving is never blocked, so nothing is left behind.
const SAMPLE_WIZARD_ID = 'capability-library-sample';
const SAMPLE_PLANS = [
  { id: 'essential', name: 'Postpaid Essential', note: 'QAR 115 / month' },
  { id: 'plus', name: 'Postpaid Plus', note: 'QAR 200 / month' },
];
function Wizard() {
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const push = useNotificationStore((s) => s.pushToast);
  useEffect(() => {
    clearDraft(SAMPLE_WIZARD_ID);
    return () => clearDraft(SAMPLE_WIZARD_ID);
  }, [clearDraft]);
  const steps: WizardStep[] = [
    {
      key: 'identity',
      label: 'Customer Identification',
      render: ({ values, setValue }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="ID Number" value={(values.idNumber as string) ?? ''} onChange={(e) => setValue('idNumber', e.target.value)} />
          <Input label="Full name" value={(values.name as string) ?? ''} onChange={(e) => setValue('name', e.target.value)} />
        </div>
      ),
      isValid: (values) => Boolean(values.idNumber && values.name),
      summary: [
        { key: 'idNumber', label: 'ID Number', type: 'text', sensitive: true, value: (v) => v.idNumber },
        { key: 'name', label: 'Name', type: 'text', value: (v) => v.name },
      ],
    },
    {
      key: 'plan',
      label: 'Offers & Plans',
      render: ({ values, setValue }) => (
        <div className="grid gap-3 sm:grid-cols-2">
          {SAMPLE_PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={values.plan === p.id}
              onClick={() => setValue('plan', p.id)}
              className={`rounded-[var(--radius-card)] border p-4 text-left ${values.plan === p.id ? CARD_SELECTED : CARD_IDLE}`}
            >
              <span className="block text-fg font-semibold">{p.name}</span>
              <span className="block text-fg-2 text-[length:var(--fs-caption)]">{p.note}</span>
            </button>
          ))}
        </div>
      ),
      isValid: (values) => Boolean(values.plan),
      summary: [{ key: 'plan', label: 'Plan', type: 'text', value: (v) => SAMPLE_PLANS.find((p) => p.id === v.plan)?.name }],
    },
    {
      key: 'review',
      label: 'Checkout',
      render: () => <p className="text-fg-2 text-[length:var(--fs-body)]">The last step: Continue becomes Save &amp; Finish and submits the journey.</p>,
    },
  ];
  return (
    <GuidedActivationWizard
      wizardId={SAMPLE_WIZARD_ID}
      title="Sample journey"
      confirmLeave={false}
      steps={steps}
      onSubmit={() => {
        push('success', 'Sample journey submitted.');
        clearDraft(SAMPLE_WIZARD_ID);
      }}
    />
  );
}
// Customer Qualification on the real wizard as a one-step journey, so its outcomes and footer actions (Continue, Proceed to Approval,
// the hard-stop message) work as they do in New Connection. A scan or a typed ID of a test customer runs the checks.
const QUALIFICATION_WIZARD_ID = 'capability-library-qualification';
function Qualification() {
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const push = useNotificationStore((s) => s.pushToast);
  useEffect(() => {
    clearDraft(QUALIFICATION_WIZARD_ID);
    return () => clearDraft(QUALIFICATION_WIZARD_ID);
  }, [clearDraft]);
  return (
    <GuidedActivationWizard
      wizardId={QUALIFICATION_WIZARD_ID}
      title="Sample journey"
      confirmLeave={false}
      steps={[customerQualificationStep({ flow: 'new', existingCustomerId: undefined, guardedContactChange: (v, setValue) => setValue('contact', v), productAgnostic: true })]}
      onSubmit={() => {
        push('success', 'Customer qualified (sample journey).');
        clearDraft(QUALIFICATION_WIZARD_ID);
      }}
    />
  );
}
// CUST-1001 holds postpaid and prepaid lines; the switcher is the lineType a journey passes.
function Lines() {
  const [line, setLine] = useState<CustomerLine | undefined>();
  return (
    <Variants
      items={[
        { key: 'all', label: 'All mobile lines' },
        { key: 'postpaid', label: 'Postpaid lines' },
        { key: 'prepaid', label: 'Prepaid lines' },
      ]}
      render={(k) => <LineSelection customerId="CUST-1001" lineType={k === 'all' ? undefined : k} value={line} onChange={setLine} />}
    />
  );
}
function Complete() {
  return (
    <ActivationComplete
      order={{ orderId: 'ORD-SAMPLE', activityId: 'ACT-SAMPLE', pendingApproval: false, customerName: 'Sample Customer', msisdn: '+974 5555 0100', planName: 'Postpaid Essential', simType: 'eSIM', dueTodayQar: 0, monthlyRecurringQar: 115 }}
      showActivityId
    />
  );
}

export const CAPABILITY_PREVIEWS: Record<string, () => ReactNode> = {
  'customer-identification': () => <Identification />,
  'special-discounts-identification': () => <SpecialDiscountsId />,
  'number-selection': () => <Number />,
  'billing-account': () => <Billing />,
  'service-address': () => <Address />,
  'plan-selection': () => <Plan />,
  'caf-signature': () => <Caf />,
  'checkout-summary': () => <Checkout />,
  payment: () => <Pay />,
  'appointment-booking': () => <Appointment />,
  'activity-comments': () => <Activity />,
  'sim-type': () => <Sim />,
  'addons-selection': () => <Addons />,
  'customer-type': () => <CustomerType />,
  'cross-sell-offers': () => <CrossSell />,
  'eligibility-gate': () => <Eligibility />,
  'selectable-card-styling': () => <Cards />,
  'side-drawer': () => <DrawerDemo />,
  toasts: () => <ToastDemo />,
  'activation-complete': () => <Complete />,
  'guided-activation-wizard': () => <Wizard />,
  'customer-qualification': () => <Qualification />,
  'line-selection': () => <Lines />,
};
