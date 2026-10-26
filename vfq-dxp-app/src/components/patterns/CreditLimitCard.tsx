import { Select } from '../primitives/Select';
import { creditLimitPolicy } from '../../engines/creditLimit';
import { accountTypeForJourney, creditLimitOptions, creditSegmentOf, customerCategoryOf, defaultCreditLimitFor, payableAtActivationQar, type JourneyAccountType } from '../../engines/creditLimit';
import { isHrn } from '../../engines/hrnConfiguration';
import { formatQar, formatQarAny } from '../../lib/format';

const row = 'flex items-baseline justify-between gap-4 py-1.5';

/**
 * A NEW account's credit limit (a new customer, or a customer with no billing account yet): the account type the agent's journey opens, the customer's
 * segment (Qatari / Expat) and category (HRN / Non-HRN) read from their nationality, the default limit and what is payable - and the agent's choice of
 * limit, from the values that apply to the segment only. For an HRN customer there is no choice.
 */
export function CreditLimitCard({
  nationality,
  selected,
  onChange,
  accountType = accountTypeForJourney('postpaid'),
  hrnFeeApplies = true,
  customerSegment,
}: {
  nationality: string | undefined;
  /** The agent's chosen limit; undefined means the default. */
  selected: number | undefined;
  onChange: (limitQar: number | undefined) => void;
  accountType?: JourneyAccountType;
  /** The HRN fee (advance) applies to this customer: false when their Credit Risk Exemption is Low or No. Defaults to the nationality's answer. */
  hrnFeeApplies?: boolean;
  /** The customer's segment: a Safwa, Safwa+ or Royal customer's limit cannot be changed (creditLimitPolicy), as an HRN customer's cannot. */
  customerSegment?: string;
}) {
  const segment = creditSegmentOf(nationality);
  const category = customerCategoryOf(nationality);
  const defaultQar = defaultCreditLimitFor(nationality);
  const options = creditLimitOptions(nationality);
  const hrn = isHrn(nationality);
  const policy = creditLimitPolicy({ segment: customerSegment, nationality });
  const advance = hrn && hrnFeeApplies ? payableAtActivationQar(nationality) : 0;
  const value = selected !== undefined && options.includes(selected) ? selected : defaultQar;
  return (
    <section aria-label="Credit limit" className="card p-5 space-y-3 mt-4">
      <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Credit Limit</h3>
      <dl className="divide-y divide-border-soft text-[length:var(--fs-body)]">
        <div className={row}>
          <dt className="text-fg-2">Account Type</dt>
          <dd className="text-fg font-medium">{accountType.startsWith('Consumer') ? 'Consumer' : accountType}</dd>
        </div>
        <div className={row}>
          <dt className="text-fg-2">Customer Segment</dt>
          <dd className="text-fg font-medium">{segment ?? '-'}</dd>
        </div>
        <div className={row}>
          <dt className="text-fg-2">Customer Category</dt>
          <dd className="text-fg font-medium">{category}</dd>
        </div>
        <div className={row}>
          <dt className="text-fg-2">Default Credit Limit</dt>
          <dd className="text-fg font-medium">{formatQarAny(defaultQar)}</dd>
        </div>
        <div className={row}>
          <dt className="text-fg-2">Amount Payable</dt>
          <dd className="text-fg font-medium">{advance > 0 ? `${formatQar(advance)} advance` : hrn ? 'No advance payable (HRN fee not marked: Credit Risk Exemption Low or No)' : 'No advance payable'}</dd>
        </div>
      </dl>
      <Select
        label="Credit Limit (QAR)"
        value={String(value)}
        disabled={!policy.editable}
        helperText={!policy.editable ? (hrn && policy.lock === 'hrn' ? 'Credit limit modification is not allowed for an HRN customer.' : policy.message) : `Choose a limit up to the ${segment ?? 'customer'} default of ${formatQar(defaultQar)}.`}
        options={options.map((o) => ({ value: String(o), label: `${formatQar(o)}` }))}
        onChange={(e) => onChange(Number(e.target.value) === defaultQar ? undefined : Number(e.target.value))}
      />
    </section>
  );
}
