import { useEffect, useRef, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Select } from '../primitives/Select';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useAuthStore } from '../../stores/authStore';
import { isQatarMobileLocalNumber } from '../primitives/countryDialCodes';
import {
  FREE_NUMBER_PRICE_CEILING_QAR,
  STAR_NUMBER_ENTITLEMENT_MULTIPLIER,
  starNumberOverageQar,
} from '../../engines/postpaidPricing';

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
 * 'Free' and 'Star' are now PRICE BANDS (2026-09-28 direction: "show only
 * numbers priced from QAR 0 up to, but not including, QAR 1,000" under Free),
 * not the stored `category` field - see FREE_NUMBER_PRICE_CEILING_QAR
 * (postpaidPricing.ts) for why this is also a correctness fix, not just a
 * rename: star-number-tiers.json's own lowest tier starts at 1000
 * (STAR-TIER-01, valueRangeMin 1000), so a handful of seeded numbers
 * category='Star' priced 300-900 already matched no tier at all - "Not
 * banded" on a number that was never going to be. Pricing the tabs
 * themselves means those numbers now land where they actually behave: no
 * lock-in, no tier, same as every other number under 1000. 'Reserved' is a
 * STATUS and cuts across both bands, so a reserved Star number appears there
 * rather than falling out of the UI entirely - which is what happened when
 * Reserved numbers were simply hidden.
 */
type NumberTab = 'Free' | 'Star' | 'Reserved';

const TAB_LABELS: Record<NumberTab, string> = {
  Free: 'Free Numbers',
  Star: 'Star Numbers',
  Reserved: 'Reserved Numbers',
};

/**
 * Tab ORDER is fixed for every channel as of 2026-09-28: Free, Star,
 * Reserved. This replaces the channel-based order used until then (Retail -
 * Reserved, Star, Free; Tablet/field - Free, Star, Reserved), which existed
 * so a retail agent working a number the customer already held would see it
 * first. That job now belongs to the auto-select-on-load effect below
 * instead of the tab ORDER itself - an agent whose customer holds a reserved
 * number lands on the Reserved tab regardless of channel, while the tabs
 * themselves stay in one predictable order for everyone.
 */
const TAB_ORDER: NumberTab[] = ['Free', 'Star', 'Reserved'];

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

/**
 * How many numbers one agent may hold at a time (2026-09-28 direction).
 * Applied to the action that creates a hold, not to selecting one already
 * held - re-picking your own reservation is not a new one.
 */
const MAX_RESERVATIONS_PER_AGENT = 2;

/** How many rows are shown at once before Next/Previous (walkthrough: 10). */
const PAGE_SIZE = 10;

/**
 * Sort orders, offered on Free and Star, NOT Reserved.
 *
 * Both bands now have real price spread to sort by: Star is 1000 and up,
 * and Free (2026-09-28's price-band split moved the 300-900 rows that used
 * to read category='Star' in here) runs 0-999 - no longer the flat QR0 list
 * it used to be, so a price sort is no longer a no-op there either. Reserved
 * stays excluded: it is a short held-numbers list an agent scans rather than
 * ranks, capped at MAX_RESERVATIONS_PER_AGENT, where a sort control would
 * answer a question nobody asks of it.
 *
 * Reserved therefore sorts by NUMBER_ASC implicitly, with no control on
 * screen. An earlier revision showed the dropdown everywhere on the
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
  /**
   * The selected plan's MRC, for BR-115's star-number entitlement note
   * (2026-09-28) - MRC x STAR_NUMBER_ENTITLEMENT_MULTIPLIER is what a star
   * number costs nothing extra up to; only the amount above it is ever
   * billed (see engines/postpaidPricing.ts's starNumberOverageQar, the same
   * function Checkout uses so the two surfaces cannot disagree). Undefined
   * simply omits the entitlement note rather than assuming a plan exists -
   * this component has no other dependency on the Plan & Add-ons step.
   */
  planMrcQar?: number;
}

// A full Qatar MSISDN: +974 followed by an 8-digit mobile local number
// (isQatarMobileLocalNumber - same leading-digit rule GuidedContactStep's
// isValidAltPhone uses) - stricter than that general validator since a
// number being reserved here must be a complete, dialable MSISDN with the
// +974 prefix present, not any alternate-contact phone shape.
function isValidMsisdn(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, '');
  return digits.startsWith('+974') && isQatarMobileLocalNumber(digits.slice(4));
}

// Pattern 10: Number Selection / Reservation Step - 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
export function MsisdnPicker({ selected, onSelect, planMrcQar }: MsisdnPickerProps) {
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [tab, setTab] = useState<NumberTab>('Free');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('price-desc');
  const [page, setPage] = useState(0);
  // numbers.json records a reservation against the agent's DISPLAY NAME
  // ("Fatima Al-Kuwari"), which is the identity resolved from
  // users-agents.json at sign-in - NOT persona.name, which is the role label
  // ("Retail Sales Agent") and matches no reservedBy value.
  const agentName = useAuthStore((s) => s.profile?.name) ?? '';
  const [customMsisdn, setCustomMsisdn] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // Whether the manual-entry FORM is open. Only consulted once a number is
  // already selected - see the render below - so this starts false with no
  // effect on the unselected case, where the form is always shown inline.

  useEffect(() => {
    mockDataEngine.list<MsisdnRecord>('numbers').then(setNumbers);
  }, []);

  // Auto-open Reserved on load if this customer already has one, else the
  // Free default stands (2026-09-28 request). Guarded to fire only once: it
  // runs the first time `numbers` arrives from the mock data engine and must
  // not re-fire on every later change to that list - reserving a NEW number
  // later in this same session (reserveCustom below) must not yank the agent
  // back to a tab they have since navigated away from.
  const hasAutoSelectedTab = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedTab.current || numbers.length === 0) return;
    hasAutoSelectedTab.current = true;
    const alreadyReserved = numbers.some((n) => n.status === 'Reserved' && n.reservedBy === agentName);
    if (alreadyReserved) setTab('Reserved');
  }, [numbers, agentName]);

  const reserveCustom = () => {
    if (atReservationCap) {
      setCustomError(
        `You already hold ${MAX_RESERVATIONS_PER_AGENT} reserved numbers. Release one before reserving another.`
      );
      return;
    }
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
  // The Reserved tab is THIS AGENT'S holds, not everyone's (2026-09-28). It
  // used to list all five reservations in the dataset, including four held by
  // other agents that this one cannot use - a list where most rows were
  // unusable and nothing on screen said why.
  const myReserved = numbers.filter((n) => n.status === 'Reserved' && n.reservedBy === agentName);
  const inTab =
    tab === 'Reserved'
      ? myReserved
      : numbers.filter(
          (n) =>
            n.status === 'AVAILABLE'
              && (tab === 'Free' ? n.priceQAR < FREE_NUMBER_PRICE_CEILING_QAR : n.priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR)
        );

  // An agent may hold at most two numbers at a time. Enforced on the action
  // that CREATES a hold (manual reservation); picking one of their own
  // existing holds off this tab is not a new reservation and stays allowed
  // however many they have.
  const atReservationCap = myReserved.length >= MAX_RESERVATIONS_PER_AGENT;

  // Sort is Free-and-Star now, not Star-only (2026-09-28): Free stopped being
  // a flat QR0 list the moment the price-band split moved the 300-900
  // formerly-Star rows into it, so a price sort now has something to do
  // there too. Reserved stays excluded - see the SortKey doc comment above.
  const showControls = tab === 'Free' || tab === 'Star';

  // Without a control on screen, the order must not depend on whatever the
  // agent last chose on Free or Star.
  const effectiveSort: SortKey = showControls ? sort : 'number-asc';

  const filtered = inTab
    .filter((n) => {
      // No search on Reserved (2026-09-28): an agent holds at most
      // MAX_RESERVATIONS_PER_AGENT numbers, so there is nothing there worth
      // narrowing, and the search box is hidden below - filtering against a
      // leftover query typed on another tab would silently hide a held
      // number with no visible control on screen to explain why.
      if (tab === 'Reserved') return true;
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
        {TAB_ORDER.map((t) => (
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
      {/* States the cap up front rather than only on the error that hitting it
          produces - an agent planning a second reservation should be able to
          see they are at the limit before they try. */}
      {tab === 'Reserved' && (
        <p className={`text-[length:var(--fs-caption)] ${atReservationCap ? 'text-[var(--warn-text)]' : 'text-muted'}`}>
          You hold {myReserved.length} of {MAX_RESERVATIONS_PER_AGENT} reserved numbers.
          {atReservationCap && ' Release one before reserving another.'}
        </p>
      )}
      {/* Hidden on Reserved (2026-09-28): a customer can hold at most
          MAX_RESERVATIONS_PER_AGENT numbers, so there is nothing to search -
          same reasoning as showControls just below, applied to this box
          instead of the tier/sort row. */}
      {tab !== 'Reserved' && (
        <Input
          aria-label="Search 8-digit number"
          placeholder="Search 8-digit number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      )}

      {/* Sort, right-aligned on its own row - per the 2026-09-26 asset. Narrows
          the same list the search box above it does, so it sits with it
          rather than over the results.

          The WHOLE ROW is absent on Reserved (see showControls): that tab is
          a short held-numbers list an agent scans rather than ranks, and an
          empty control row would leave a gap the agent reads as something
          having failed to load. */}
      {/* Tier chips (Platinum / Gold / Silver) and the TIER filter were removed
          on 2026-09-27 per the annotated walkthrough. Sort stays, and as of
          2026-09-28 acts on Free as well as Star, now that Free is a real
          price band (0-999) rather than a flat QR0 list. */}
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
      {/* BR-115 entitlement, stated once up front rather than only on each
          card that exceeds it (2026-09-28) - the agent should know the cap
          before scanning individual prices, not discover it row by row.
          Shown on Free too, not just Star: the price-band split above means
          Free can carry priced (300-999) numbers now, not only QR0 ones. */}
      {tab !== 'Reserved' && planMrcQar !== undefined && (
        <p className="text-muted text-[length:var(--fs-caption)]">
          This plan entitles a Star Number up to QR {planMrcQar * STAR_NUMBER_ENTITLEMENT_MULTIPLIER} at no extra charge.
          Anything above that is billed the difference.
        </p>
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
                {/* The Free badge is gone as of 2026-09-28 - every number now
                    shows its actual catalogue price (QAR 0, 300, 500, 700,
                    900...) rather than a pill that hid the figure entirely
                    for the QR0 rows. "Free to the customer" is still true for
                    anything under FREE_NUMBER_PRICE_CEILING_QAR - that is exactly
                    what puts a number in this tab at all - but it is now
                    stated by showing QR 0 alongside QR 300/500/700/900
                    rather than by a badge some rows got and others didn't. */}
                <span className="text-right shrink-0">
                  <span className="text-fg font-semibold block">QR {n.priceQAR}</span>
                  {/* BR-115 entitlement/overage readout - Star-range only
                      (>= FREE_NUMBER_PRICE_CEILING_QAR). Everything below that is
                      "free to the customer" outright per the same 2026-09-28
                      direction - CheckoutSummaryStep's isStarNumber uses the
                      identical threshold, so a number that reads plain here
                      never turns into a Star line with a lock-in there. */}
                  {planMrcQar !== undefined && n.priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR && (
                    (() => {
                      const overage = starNumberOverageQar(planMrcQar, n.priceQAR);
                      return overage > 0 ? (
                        <span className="block text-[length:var(--fs-caption)] text-[var(--warn-text)]">
                          +QR {overage} extra
                        </span>
                      ) : (
                        <span className="block text-[length:var(--fs-caption)] text-success">
                          No extra charge
                        </span>
                      );
                    })()
                  )}
                </span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted text-[length:var(--fs-body)] col-span-full">
            {tab === 'Reserved'
              ? 'You have no reserved numbers.'
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
