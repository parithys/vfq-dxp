import { formatQar, VAT_RATE } from '../../engines/postpaidPricing';
import type { MonthlyCharges } from '../../engines/postpaidPricing';
import type { Discount } from './postpaidPlanModel';

interface PostpaidMonthlySummaryProps {
  charges: MonthlyCharges;
  selectedDiscount: Discount | undefined;
  /** What an offer bundles, listed as "Included in offer". */
  bundledItems?: string[];
  /** Add-ons the agent chose, listed as "Added". */
  addedAddons?: { name: string; mrcQAR: number }[];
}

export function PostpaidMonthlySummary({ charges, selectedDiscount, bundledItems = [], addedAddons = [] }: PostpaidMonthlySummaryProps) {
  return (
    // Left accent bar (2026-09-28 mockup) - the one box on this step that
    // is a running total rather than a choice to make, so it reads as a
    // callout the same way Checkout's own "Due today" panel does, not as
    // a fourth option card.
    // Dark panel (2026-10-09 reference): fixed navy with white text in both themes.
    <div className="rounded-[var(--radius-card-lg)] bg-[var(--summary-bg)] text-[var(--summary-fg)] p-6 flex items-start justify-between flex-wrap gap-4">
      {/* Left: an itemised breakdown under a label, per the 2026-09-26
          asset. Was one run-on caption line - "Live Cart Total · Base plan
          QAR 500/mo · Loyalty Discount (-15%) · Add-ons QAR 50/mo" - where
          the middot-joined items ran together as prose and the label sat
          inline with the first of them. A stacked label over one line per
          charge reads as a summary; the label also drops "Live Cart Total",
          which described the widget rather than its contents. */}
      {/* A two-column table, per the 2026-09-26 asset. These were inline
          "label value" sentences, so each amount started wherever its own
          label happened to end - QAR 750, -15% and QAR 50 at three
          different x positions, which is the one thing a column of figures
          must not do. A real <table> rather than stacked divs: it IS
          tabular, and scope="row" makes each amount announce with the
          charge it belongs to instead of as a loose number.
          
          Width is fixed rather than fitted to content so the right column
          does not move as the rows change - adding an add-on or a discount
          would otherwise re-align every amount above it. */}
      <table className="w-[min(32rem,100%)] text-[length:var(--fs-caption)]">
        <caption className="opacity-70 text-[length:var(--fs-tag)] font-semibold uppercase tracking-wide text-left pb-2">
          Monthly summary
        </caption>
        <tbody className="divide-y divide-[var(--divider-on-dark)]">
          {[
            ['Plan', formatQar(charges.planQar)],
            // The RATE moves into the label and the AMOUNT into the value,
            // so the value column is money throughout and therefore adds
            // up. It read "-15%", which told the agent the rate but left
            // them to work out what it was worth against a 750 plan - and
            // put a percentage in a column of currency.
            ...(selectedDiscount
              ? [
                  [
                    `${selectedDiscount.name} (${Math.round(Math.abs(selectedDiscount.price) * 100)}%) · Added`,
                    `-${formatQar(charges.discountQar)}`,
                  ],
                ]
              : []),
            ...addedAddons.map((a) => [`${a.name} · Added`, formatQar(a.mrcQAR)]),
            ...bundledItems.map((b) => [`${b} · Included in offer`, 'Included']),
            // VAT last and always shown, even at zero: a tax line that
            // appears only sometimes reads as a surcharge the agent has
            // triggered. It is charged on the net of everything above it,
            // which is why it cannot simply be a footnote on the total.
            [`VAT (${Math.round(VAT_RATE * 100)}%)`, formatQar(charges.vatQar)],
          ].map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className="opacity-80 font-normal text-left py-1.5 pr-4">
                {label}
              </th>
              <td className="font-semibold text-right py-1.5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Right: label above the figure, not beside it, per the asset - and
          "/mo" set small against the amount so the number carries the
          weight rather than the unit. text-right so the stack aligns to
          the card's edge instead of to its own longest line. */}
      <div className="text-right pt-3">
        <p className="opacity-80 text-[length:var(--fs-caption)]">Total monthly</p>
        <p className="font-bold text-[length:var(--fs-h3)] leading-tight">
          {formatQar(charges.totalQar)}
          <span className="text-[length:var(--fs-caption)] font-bold">/mo</span>
        </p>
      </div>
    </div>
  );
}
