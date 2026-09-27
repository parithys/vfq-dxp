import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button, PRIMARY_SURFACE } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Select } from '../primitives/Select';
import * as mockDataEngine from '../../engines/mockDataEngine';

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
  Star: 'Star Number (Premium)',
  Reserved: 'Reserved Numbers',
};

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

const ALL_TIERS = 'All';

// The tier chip order, per direction: Platinum, Gold, Silver - the metal
// ranking, not the alphabet. Values not listed here sort after everything
// that is.
const TIER_RANK: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2 };

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
  const [tier, setTier] = useState<string>(ALL_TIERS);
  const [customMsisdn, setCustomMsisdn] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // Whether the manual-entry FORM is open. Only consulted once a number is
  // already selected - see the render below - so this starts false with no
  // effect on the unselected case, where the form is always shown inline.
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

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
    setManualEntryOpen(false);
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

  // WHICH tiers exist is still derived from the data, so the chips match
  // whatever the catalogue actually holds rather than a hardcoded list. Their
  // ORDER is not derived, though - alphabetical put them Gold, Platinum,
  // Silver, which is not the tier ranking, and .sort() has no way to know
  // Platinum outranks Gold. TIER_RANK is the one place that ordering is
  // spelled out; a tier absent from it (there shouldn't be one) sorts last
  // rather than throwing, so an unrecognised value still renders instead of
  // vanishing.
  const tiers = showControls
    ? [...new Set(inTab.map((n) => n.valueTier).filter((t): t is string => Boolean(t)))].sort(
        (a, b) => (TIER_RANK[a] ?? 99) - (TIER_RANK[b] ?? 99)
      )
    : [];

  // Without a control on screen, the order must not depend on whatever the
  // agent last chose on the Star tab.
  const effectiveSort: SortKey = showControls ? sort : 'number-asc';

  const filtered = inTab
    .filter((n) => {
      const matchesSearch = search ? n.msisdn.includes(search) : true;
      // Only applied where the chips are on screen. A tier left selected
      // while switching to a tab that has no tiers would otherwise empty the
      // list with no visible control to explain why.
      const matchesTier = tiers.length === 0 || tier === ALL_TIERS || n.valueTier === tier;
      return matchesSearch && matchesTier;
    })
    .sort(SORTERS[effectiveSort]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Free', 'Star', 'Reserved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              // A tier chosen on Star means nothing on Free. Reset rather than
              // carry it across, so no tab ever opens pre-filtered by a
              // control the agent cannot see.
              setTier(ALL_TIERS);
            }}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              tab === t ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <Input aria-label="Search 8-digit number" placeholder="Search 8-digit number" value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Tier filter left, sort right, on one row - per the 2026-09-26 asset.
          Both narrow the same list the search box above them does, so they sit
          with it rather than over the results.
          
          The WHOLE ROW is absent on Free and Reserved (see showControls), not
          just its contents: neither control can act on those tabs, and an
          empty control row would leave a gap the agent reads as something
          having failed to load. */}
      {showControls && (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Chips, not a second dropdown: there are at most three tiers and the
            agent switches between them repeatedly while quoting, so each is
            one click away and the current one is visible without opening
            anything. */}
        {tiers.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Tier</span>
            {[ALL_TIERS, ...tiers].map((t) => {
              const active = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  aria-pressed={active}
                  className={`px-3 py-1 rounded-[var(--radius-button)] text-[length:var(--fs-caption)] border transition-colors ${
                    active
                      ? `${PRIMARY_SURFACE} enabled:hover:bg-[image:var(--accent-gradient-hover)] font-medium`
                      : 'bg-bg text-fg-2 border-border hover:border-[var(--field-card-selected)]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ) : (
          // Keeps the sort control at the row's right edge if a Star tab ever
          // holds untiered numbers, instead of letting it slide left.
          <span />
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Sort</span>
          <Select
            aria-label="Sort numbers"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          />
        </div>
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
        {filtered.map((n) => {
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
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 min-w-0">
                  {n.valueTier && <Badge variant="outlined-red">{n.valueTier}</Badge>}
                  {tab === 'Reserved' && (
                    <Badge variant="filled-neutral">{n.reservedBy ? `Held by ${n.reservedBy}` : 'Reserved'}</Badge>
                  )}
                  <span className="text-fg font-medium truncate">{n.msisdn}</span>
                </span>
                {/* --fg weight rather than the muted caption it used to carry:
                    on a Star number the price is the fact being chosen
                    between, so it should not be the quietest thing in the
                    row. */}
                <span className="text-fg font-semibold shrink-0">QR {n.priceQAR}</span>
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
      {selected && (
        <p className="text-success text-[length:var(--fs-caption)]">
          SUCCESS: Reservation Token: SBL-EXL-{selected.slice(-5)}
        </p>
      )}

      {/* Manual entry is the ALTERNATIVE to picking from the list above, not
          a second required step - but with a number already selected, an
          always-visible form sitting right under "SUCCESS" read as exactly
          that: live, empty, and asking for something. ("Why do I need this?"
          after already choosing a number.)

          Collapsed to a link once `selected` is set, rather than removed -
          the agent may still want to override a list pick with a specific
          number, and that has to stay reachable. Before a selection exists
          there is nothing to collapse: the form is simply the other of two
          equal ways to get a number, so it renders inline as it always has. */}
      {selected && !manualEntryOpen ? (
        <button
          type="button"
          onClick={() => setManualEntryOpen(true)}
          className="text-accent text-[length:var(--fs-caption)] font-medium hover:underline"
        >
          Enter a different MSISDN manually
        </button>
      ) : (
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
