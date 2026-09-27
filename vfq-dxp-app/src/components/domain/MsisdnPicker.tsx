import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Select } from '../primitives/Select';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { usePersonaStore } from '../../stores/personaStore';
import { getPersona } from '../../engines/configEngine';

interface MsisdnRecord {
  msisdn: string;
  category: string;
  status: string;
  priceQAR: number;
  valueTier?: string;
  /** Who holds the reservation, on a Reserved record. */
  reservedBy?: string;
}

/**
 * The three tabs, which do NOT all filter on the same axis - and that is the
 * point rather than an inconsistency.
 *
 * 'Free' and 'Star' are CATEGORIES (pricing tiers) and each shows only its
 * AVAILABLE numbers. 'Reserved' is a STATUS and cuts across both categories,
 * so a reserved Star number appears there rather than falling out of the UI
 * entirely - which is what happened when Reserved numbers were simply hidden.
 */
type NumberTab = 'Free' | 'Star' | 'Reserved';

const TAB_LABELS: Record<NumberTab, string> = {
  Free: 'Free Number',
  Star: 'Star Numbers',
  Reserved: 'Reserved Numbers',
};

/**
 * Tab ORDER follows the channel (2026-09-27 walkthrough):
 *   Retail  - Reserved, Star, Free
 *   Tablet  - Free, Star, Reserved
 *
 * A retail agent is usually working a number the customer already holds or is
 * paying for, so those lead; a tablet/field agent is usually handing out
 * whatever is free. The channel comes off the signed-in persona rather than a
 * prop, because it is a fact about who is serving, not about this step.
 */
const TAB_ORDER_RETAIL: NumberTab[] = ['Reserved', 'Star', 'Free'];
const TAB_ORDER_TABLET: NumberTab[] = ['Free', 'Star', 'Reserved'];

/**
 * Qatar MSISDNs are stored E.164 (+9743300...) but shown as the bare 8-digit
 * local number: every number in this picker is Qatari, so the country code is
 * the same eleven characters on every row and carries no information the agent
 * is choosing between. Grouped 4+4, which is how they are read aloud.
 */
function toLocalMsisdn(msisdn: string): string {
  const local = msisdn.replace(/[\s-]/g, '').replace(/^\+?974/, '');
  return /^\d{8}$/.test(local) ? `${local.slice(0, 4)} ${local.slice(4)}` : msisdn;
}

/** How many rows are shown at once before Next/Previous (walkthrough: 10). */
const PAGE_SIZE = 10;

/**
 * Sort orders, offered on the STAR TAB ONLY.
 *
 * Star is the only tab where any of them does anything. Its numbers are priced
 * 300 to 5000, and the agent works down from the best one the customer's plan
 * entitles them to. Every Free number is QR 0, so both price orders are no-ops
 * there, which would leave a dropdown whose only working option is Number -
 * and a one-option dropdown is a control that looks like a choice. Reserved is
 * a short held-numbers list an agent scans rather than ranks.
 *
 * Both of those tabs therefore sort by NUMBER_ASC implicitly, with no control
 * on screen. An earlier revision showed the dropdown everywhere on the
 * reasoning that a control changing its options per tab is hard to trust; the
 * better answer is not to show a control that cannot act.
 */
type SortKey = 'price-desc' | 'price-asc' | 'number-asc' | 'number-desc';

// Both directions for BOTH keys. Offering "Number: ascending" without its
// descending counterpart made the one key asymmetric against the other - price
// had two directions and number one - so the menu implied number order was
// somehow one-way.
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'number-asc', label: 'Number: ascending' },
  { value: 'number-desc', label: 'Number: descending' },
];

const SORTERS: Record<SortKey, (a: MsisdnRecord, b: MsisdnRecord) => number> = {
  // Ties broken by number, so a page of equally-priced numbers holds a stable
  // order instead of reshuffling on every render.
  'price-desc': (a, b) => b.priceQAR - a.priceQAR || a.msisdn.localeCompare(b.msisdn),
  'price-asc': (a, b) => a.priceQAR - b.priceQAR || a.msisdn.localeCompare(b.msisdn),
  'number-asc': (a, b) => a.msisdn.localeCompare(b.msisdn),
  'number-desc': (a, b) => b.msisdn.localeCompare(a.msisdn),
};


// ranking, not the alphabet. Values not listed here sort after everything
// that is.

interface MsisdnPickerProps {
  selected?: string;
  onSelect: (msisdn: string, priceQAR: number) => void;
}

// A full Qatar MSISDN: +974 followed by an 8-digit local number starting
// 3/5/6/7 (same shape as every seeded numbers.json record and the same
// leading-digit rule GuidedContactStep's isValidAltPhone uses for a Qatar
// local number) - stricter than that general validator since a number
// being reserved here must be a complete, dialable MSISDN, not any
// alternate-contact phone shape.
function isValidMsisdn(raw: string): boolean {
  return /^\+974[3567]\d{7}$/.test(raw.replace(/[\s-]/g, ''));
}

// Pattern 10: Number Selection / Reservation Step - 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
export function MsisdnPicker({ selected, onSelect }: MsisdnPickerProps) {
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [tab, setTab] = useState<NumberTab>('Free');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('price-desc');
  const [page, setPage] = useState(0);
  // Tab order is a property of the CHANNEL the agent is serving on, read off
  // the signed-in persona. Anything that is not an in-store retail channel
  // (tablet, field, telesales) gets the Free-first order.
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const channel = getPersona(activePersonaId)?.channel ?? '';
  const tabOrder = /retail|in-store/i.test(channel) ? TAB_ORDER_RETAIL : TAB_ORDER_TABLET;
  const [customMsisdn, setCustomMsisdn] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // Whether the manual-entry FORM is open. Only consulted once a number is
  // already selected - see the render below - so this starts false with no
  // effect on the unselected case, where the form is always shown inline.

  useEffect(() => {
    mockDataEngine.list<MsisdnRecord>('numbers').then(setNumbers);
  }, []);

  const reserveCustom = () => {
    if (!isValidMsisdn(customMsisdn)) {
      setCustomError('Enter a full international format MSISDN (e.g. +974 3300 1234).');
      return;
    }
    const normalized = customMsisdn.replace(/[\s-]/g, '');
    const existing = numbers.find((n) => n.msisdn === normalized);
    if (existing && existing.status !== 'AVAILABLE') {
      setCustomError(`${normalized} is already ${existing.status.toLowerCase()} - choose a different number.`);
      return;
    }
    setCustomError(null);
    onSelect(normalized, existing?.priceQAR ?? 0);
    // Collapse back to the link now that this custom entry succeeded - the
    // same reasoning that hides the form in the first place: nothing left to
    // fill in, so nothing to keep open.
  };

  // Category (Free vs Star/premium) and status (AVAILABLE/Reserved/BLOCKED)
  // are independent axes: the tab filters on CATEGORY, the availability check
  // on STATUS.
  //
  // Only AVAILABLE numbers are listed as of 2026-09-25. Reserved and BLOCKED
  // ones used to render greyed and unclickable, which filled the grid with
  // rows the agent could not act on - and with 18 free numbers now seeded,
  // dead cards push the selectable ones further from the top.
  //
  // They are NOT forgotten: reserveCustom below still rejects a Reserved or
  // BLOCKED number typed into Manual MSISDN Entry by name, so the inventory
  // is still enforced where an agent could otherwise ask for one.
  const inTab = numbers.filter((n) =>
    tab === 'Reserved' ? n.status === 'Reserved' : n.category === tab && n.status === 'AVAILABLE'
  );

  // Tier chips and Sort are STAR-ONLY.
  //
  // Free has no tiers at all and no price spread, so neither control has
  // anything to do. Reserved does contain tiered numbers - a reserved Star
  // number stays visible there by design - so the chips would render if this
  // were driven by tier presence alone; they are suppressed anyway, because
  // that tab is a short list of what is already held rather than an inventory
  // to narrow, and filtering it by tier answers a question nobody asks of it.
  const showControls = tab === 'Star';

  // Without a control on screen, the order must not depend on whatever the
  // agent last chose on the Star tab.
  const effectiveSort: SortKey = showControls ? sort : 'number-asc';

  const filtered = inTab
    .filter((n) => {
      // Matches the stored E.164 OR the displayed local form, so typing the
      // 8 digits the agent can see on screen finds the row.
      return search ? n.msisdn.includes(search) || toLocalMsisdn(n.msisdn).replace(/\s/g, '').includes(search.replace(/\s/g, '')) : true;
    })
    .sort(SORTERS[effectiveSort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset: deleting a search term can shrink the list
  // under the current page, and snapping to page 0 would lose the agent's
  // place every time they edited the box.
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-soft">
        {tabOrder.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              // Back to the first page: a tab switch is a new list, and
              // landing on page 3 of it would look like missing inventory.
              setPage(0);
            }}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              tab === t ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <Input
        aria-label="Search 8-digit number"
        placeholder="Search 8-digit number"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />

      {/* Tier filter left, sort right, on one row - per the 2026-09-26 asset.
          Both narrow the same list the search box above them does, so they sit
          with it rather than over the results.
          
          The WHOLE ROW is absent on Free and Reserved (see showControls), not
          just its contents: neither control can act on those tabs, and an
          empty control row would leave a gap the agent reads as something
          having failed to load. */}
      {/* Tier chips (Platinum / Gold / Silver) and the TIER filter were removed
          on 2026-09-27 per the annotated walkthrough. Sort stays: it is the one
          control that still acts on the Star list, which spans QR 300-5000 and
          is what the agent works down. */}
      {showControls && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Sort</span>
          <Select
            aria-label="Sort numbers"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          />
        </div>
      )}
      {/* Capped and scrollable as of 2026-09-25, when the Free inventory went
          from 2 numbers to 18. Seven rows of cards pushed Continue below the
          fold on every visit; the search box above narrows the list for an
          agent who knows what they want, and this keeps the step navigable for
          one who is browsing. */}
      {/* TWO COLUMNS on Free and Star, ONE on Reserved.
          
          Every card keeps the number-left / price-right row adopted on
          2026-09-26; only how many sit side by side differs. Free and Star are
          browsable inventories where two columns halve the scrolling, and at
          this width a number and its price still sit comfortably on one line.
          Reserved stays full width for the reason it always has: it is a short
          list, so a second column would leave a card stranded beside an empty
          half-row, and its rows carry an extra fact - who holds the number -
          that reads better across a full width than wrapped into half of one.
          
          Capped at 22rem and scrollable either way, with the search above it
          for an agent who already knows the number they want. */}
      <div
        className={`grid gap-3 max-h-[22rem] overflow-y-auto pr-1 ${
          tab === 'Reserved' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {paged.map((n) => {
          const isSelected = selected === n.msisdn;
          // No disabled state: everything listed is selectable. An AVAILABLE
          // number can be taken, and a Reserved one is a held number the
          // agent is deliberately looking at in order to use it.
          //
          // No status badge on the Free/Star tabs either - the filter makes it
          // constant there, so it could only print the same word. On the
          // Reserved tab it says who holds the number, which is the one thing
          // that distinguishes those rows from each other.
          return (
            <button
              key={n.msisdn}
              onClick={() => onSelect(n.msisdn, n.priceQAR)}
              className={`text-left rounded-[var(--radius-card)] border p-3
                ${isSelected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft bg-bg hover:border-[var(--field-card-selected)]'}`}
            >
              {/* TIER FIRST, then the number, with the price alone on the
                  right (2026-09-26). The tier led the badge group beside the
                  price until now, which read the number before saying what
                  KIND of number it was - and on a tier-sorted list the tier is
                  what the agent is scanning down.
                  
                  The price stays in its own right-hand slot so the figures
                  share a right edge down the column; a tier badge between them
                  and the number would have pushed each price to a different x.
                  
                  Shared by all three tabs - only the column count differs. */}
              {/* 2026-09-27: the tier badge (Platinum/Gold/Silver) and the
                  "Held by <agent>" name are both gone. Reserved rows keep a
                  plain "Reserved" marker so they are still distinguishable
                  from an available number - what was dropped is WHO holds it,
                  not THAT it is held. */}
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 min-w-0">
                  {tab === 'Reserved' && <Badge variant="filled-neutral">Reserved</Badge>}
                  <span className="text-fg font-medium truncate">{toLocalMsisdn(n.msisdn)}</span>
                </span>
                {/* A free number shows a "Free" badge rather than "QR 0": the
                    zero was the same on every row and read as a price the
                    agent had to account for. Priced numbers keep the figure at
                    --fg weight - on Star it is the fact being chosen between. */}
                {n.priceQAR > 0 ? (
                  <span className="text-fg font-semibold shrink-0">QR {n.priceQAR}</span>
                ) : (
                  <Badge variant="success">Free</Badge>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted text-[length:var(--fs-body)] col-span-full">
            {tab === 'Reserved'
              ? search
                ? 'No reserved numbers match that search.'
                : 'No reserved numbers.'
              : search
                ? 'No available numbers match that search.'
                : 'No available numbers in this category.'}
          </p>
        )}
      </div>
      {/* Ten at a time with Next/Previous (2026-09-27). The list was capped
          and scrollable, which hid how much inventory there was and gave the
          agent no way to say where they had got to. Hidden entirely on a
          single page so a one-page list carries no dead controls. */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost-rect" compact disabled={safePage === 0} onClick={() => setPage((n) => n - 1)}>
            Previous
          </Button>
          <span className="text-muted text-[length:var(--fs-caption)]">
            Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}-
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <Button
            variant="ghost-rect"
            compact
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Plain-language confirmation instead of the internal reservation token
          (2026-09-27). "SBL-EXL-02011" was a system artefact the agent could
          not act on and would not read to a customer. */}
      {selected && (
        <p className="text-success text-[length:var(--fs-caption)]">
          Number selected and reserved for this order.
        </p>
      )}

      {/* Manual MSISDN entry. The "Enter a different MSISDN manually" link
          that used to collapse this once a number was picked was removed on
          2026-09-27 per the walkthrough. The form itself stays, but only
          BEFORE a selection exists: with a number already chosen there is
          nothing for it to do, and it read as a second required step sitting
          under the confirmation. */}
      {!selected && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-2">
          <h4 className="text-fg font-semibold">Manual MSISDN Entry</h4>
          <Input
            label="Custom MSISDN"
            placeholder="+974 XXXX XXXX"
            value={customMsisdn}
            onChange={(e) => {
              setCustomMsisdn(e.target.value);
              setCustomError(null);
            }}
            error={customError ?? undefined}
            helperText="Enter a full international format MSISDN"
          />
          <Button variant="primary-rect" className="w-full" disabled={!isValidMsisdn(customMsisdn)} onClick={reserveCustom}>
            Reserve Custom Number
          </Button>
        </div>
      )}
    </div>
  );
}
