import { formatDateTime, formatQar } from '../../lib/format';
import { TabStrip } from '../primitives/TabStrip';
import { Pagination, pageWindow } from '../primitives/Pagination';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { useNotificationStore } from '../../stores/notificationStore';
import { Icon } from '../primitives/Icon';
import { CARD_IDLE, CARD_SELECTED, SelectedCardTexture } from '../primitives/offerCardParts';
import { Select } from '../primitives/Select';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useAuthStore } from '../../stores/authStore';
import { usePersonaStore } from '../../stores/personaStore';
import { Checkbox } from '../primitives/Checkbox';
import { SearchField } from '../primitives/SearchField';
import { FREE_NUMBER_PRICE_CEILING_QAR, STAR_NUMBER_ENTITLEMENT_MULTIPLIER, starNumberOverageQar } from '../../engines/postpaidPricing';
import { TAB_LABELS, TAB_ORDER, PORTAL_TAB_ORDER, RETAIL_SALES_PERSONA_ID, toLocalMsisdn, MAX_RESERVATIONS_PER_AGENT, PAGE_SIZE, FREE_PAGE_SIZE, STAR_SORT_OPTIONS, FREE_SORT_OPTIONS, PRICE_RANGES, inPriceRange, SEARCH_MODE_OPTIONS, DEFAULT_SEARCH_MODE, matchesNumberSearch, hasRepeatingPairPattern, searchError, SORTERS, STAT_ICONS } from './msisdnPickerModel';
import type { MsisdnRecord, NumberTab, SearchMode, SortKey } from './msisdnPickerModel';
import { StarStat } from './StarStat';


interface MsisdnPickerProps {
  selected?: string;
  onSelect: (msisdn: string, priceQAR: number) => void;
  /** Changes when the agent presses Refresh: the number inventory is read again. */
  refreshKey?: number;
  /** When given, clicking the selected number again calls this instead of reselecting (toggle). */
  onDeselect?: () => void;
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
  /**
   * The plan's Star Number entitlement limit (engines/postpaidPricing.ts starEntitlementQar):
   * a Star Number at or below it costs nothing extra, one above it costs the difference.
   * When omitted it is derived from planMrcQar, as before.
   */
  starEntitlementQar?: number;
  /** Search box and Sort control share one row (search grows, sort sits at the right). */
  inlineToolbar?: boolean;
  /**
   * The Number Management Portal (New Number Selection). Tabs read Star, Free, Reserved, and the Reserved tab lists only the numbers
   * reserved in this session: no number the agent already held is displayed, and none is chosen for the agent on open. Journeys leave
   * this off and keep their own tab order and held-number behaviour.
   */
  portalMode?: boolean;
  /** Portal only: the numbers reserved in this portal session (after a customer was identified), which its Reserved tab lists. */
  reservedHere?: string[];
  /** Journey: the customer's ID number. The Reserved tab lists only this agent's holds placed for that ID; with none given, every hold of the agent. */
  customerIdNumber?: string;
  /** Portal only: puts an Unreserve button on each card of the Reserved tab; called with the number to release. */
  onUnreserve?: (msisdn: string) => void;
  /** No longer read: the Reserved tab always shows its green "Reserved" pill (2026-10-04 design). Kept so existing callers still compile. */
  hideReservedBadge?: boolean;
}

// The chips abbreviate (QAR 5K); the tooltip spells the range out.
const money0 = (v: number) => formatQar(v);
const rangeTitle = (r: { min: number; max: number }) =>
  r.min === 0 ? `Under ${money0(r.max + 1)}` : Number.isFinite(r.max) ? `${money0(r.min)} \u2013 ${money0(r.max)}` : `Above ${money0(r.min - 1)}`;

const SEARCH_MIN = 2;
const SEARCH_MAX = 8;
const SEARCH_DEBOUNCE_MS = 300;

// Pattern 10: Number Selection / Reservation Step - 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
// Anything below the Star band (QAR 0 - 1,499) is free of charge whatever its catalogue price; QAR 1,500 and above is a Star Number.
const chargeFor = (priceQar: number) => (priceQar >= FREE_NUMBER_PRICE_CEILING_QAR ? priceQar : 0);

export function MsisdnPicker({ refreshKey = 0, selected, onSelect, onDeselect, planMrcQar, starEntitlementQar: starEntitlementProp, inlineToolbar = false, portalMode = false, reservedHere = [], onUnreserve, customerIdNumber }: MsisdnPickerProps) {
  const entitlementQar = starEntitlementProp ?? (planMrcQar !== undefined ? planMrcQar * STAR_NUMBER_ENTITLEMENT_MULTIPLIER : undefined);
  // Star tab filter: only numbers priced within the customer's entitlement (no extra charge).
  const [withinEntitlementOnly, setWithinEntitlementOnly] = useState(false);
  // Star tab price-range filter: none selected = "All".
  const [priceRanges, setPriceRanges] = useState<string[]>([]);
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [numbersLoaded, setNumbersLoaded] = useState(false);
  const [tab, setTab] = useState<NumberTab>(portalMode ? 'Star' : 'Free');
  // Portal: the selection belongs to the tab it was made on, so switching tabs clears it. Otherwise a number chosen on one tab would keep
  // the portal's Reserve Number button enabled while no card on the tab in view is selected.
  const previousTab = useRef(tab);
  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    if (portalMode && selected) onDeselect?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Choosing a number only selects it; in the portal it is reserved once a customer has been identified (see NumberManagementPortal).
  const choose = onSelect;
  const isRetailSales = usePersonaStore((s) => s.activePersonaId) === RETAIL_SALES_PERSONA_ID;
  const [starTiers, setStarTiers] = useState<{ valueRangeMin: number; valueRangeMax: number; lockInDurationMonths: number }[]>([]);
  // Open search (letters and numbers, 2-8 characters): `searchInput` is what is typed; `search` is the trimmed text the
  // list is actually filtered by, applied ~300 ms after typing stops and only once it has at least 2 characters.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // How the box matches (the dropdown before it): Any is what the box always did.
  const [searchMode, setSearchMode] = useState<SearchMode>(DEFAULT_SEARCH_MODE);
  // XXYY only: list every number that has a repeating-pair pattern, with no pattern typed (the search box is disabled meanwhile).
  const [allPatterns, setAllPatterns] = useState(false);
  const showingAllPatterns = searchMode === 'xxyy' && allPatterns;
  const [sort, setSort] = useState<SortKey>('price-desc');
  const [sortChosen, setSortChosen] = useState<{ Star: boolean; Free: boolean }>({ Star: false, Free: false });
  // Free's own sort state, separate from Star's `sort` above - see
  // FREE_SORT_OPTIONS. Kept apart rather than sharing one variable so each
  // tab's control always shows a value that is actually one of ITS options;
  // a shared variable defaulting to 'price-desc' would render Free's menu on
  // a value absent from its own list the moment the agent opened it without
  // having touched Star's first.
  const [freeSort, setFreeSort] = useState<'number-asc' | 'number-desc'>('number-asc');
  const [page, setPage] = useState(0);
  // numbers.json records a reservation against the agent's DISPLAY NAME
  // ("Fatima Al-Kuwari"), which is the identity resolved from
  // users-agents.json at sign-in - NOT persona.name, which is the role label
  // ("Retail Sales") and matches no reservedBy value.
  const agentName = useAuthStore((s) => s.profile?.name) ?? '';
  // Whether the manual-entry FORM is open. Only consulted once a number is
  // already selected - see the render below - so this starts false with no
  // effect on the unselected case, where the form is always shown inline.

  useEffect(() => {
    mockDataEngine.list<{ valueRangeMin: number; valueRangeMax: number; lockInDurationMonths: number }>('star-number-tiers').then(setStarTiers);
  }, []);

  // The inventory is read on open and again each time Refresh is pressed (every tab shows the same list, re-filtered).
  useEffect(() => {
    let cancelled = false;
    mockDataEngine.list<MsisdnRecord>('numbers').then((n) => {
      if (cancelled) return;
      setNumbers(n);
      setNumbersLoaded(true);
      setPage(0);
      if (refreshKey > 0) useNotificationStore.getState().pushToast('success', 'Number list refreshed', { key: 'msisdn-refreshed' });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Auto-open Reserved on load if this customer already has one, else the
  // Free default stands (2026-09-28 request). Guarded to fire only once: it
  // runs the first time `numbers` arrives from the mock data engine and must
  // not re-fire on every later change to that list - reserving a NEW number
  // later in this same session (choose below) must not yank the agent
  // back to a tab they have since navigated away from.
  const hasAutoSelectedTab = useRef(false);
  const isHeldForCustomer = (n: { status?: string; reservedBy?: string; reservedForQid?: string }) =>
    n.status === 'Reserved' && n.reservedBy === agentName && (!customerIdNumber || n.reservedForQid === customerIdNumber);
  const heldReservations = numbers.filter(isHeldForCustomer).length;
  useEffect(() => {
    if (hasAutoSelectedTab.current || !numbersLoaded || portalMode) return;
    hasAutoSelectedTab.current = true;
    // Retail Sales: Reserved when the customer's reservations exist, otherwise Star -
    // never leaving the agent to switch tabs by hand. Everyone else keeps the
    // original rule (Reserved if held, else the Free default).
    if (heldReservations > 0) setTab('Reserved');
    else if (isRetailSales) setTab('Star');
  }, [numbersLoaded, heldReservations, isRetailSales]);

  // Retail Sales sees the Reserved tab only while a reservation is held; before the
  // numbers have loaded no tab is shown, so the strip never flashes a tab that then vanishes.
  const visibleTabs = portalMode
    ? PORTAL_TAB_ORDER
    : isRetailSales
    ? numbersLoaded
      ? TAB_ORDER.filter((t) => t !== 'Reserved' || heldReservations > 0)
      : []
    : TAB_ORDER;
  // The last reservation was released while the Reserved tab was open: move to Star.
  useEffect(() => {
    if (!portalMode && isRetailSales && numbersLoaded && heldReservations === 0 && tab === 'Reserved') setTab('Star');
  }, [portalMode, isRetailSales, numbersLoaded, heldReservations, tab]);

  // Category (Free vs Star/premium) and status (AVAILABLE/Reserved/BLOCKED)
  // are independent axes: the tab filters on CATEGORY, the availability check
  // on STATUS.
  //
  // Only AVAILABLE numbers are listed as of 2026-09-25. Reserved and BLOCKED
  // ones used to render greyed and unclickable, which filled the grid with
  // rows the agent could not act on - and with 18 free numbers now seeded,
  // dead cards push the selectable ones further from the top.
  //
  // They are NOT forgotten: choose below still rejects a Reserved or
  // BLOCKED number typed into Manual MSISDN Entry by name, so the inventory
  // is still enforced where an agent could otherwise ask for one.
  // The Reserved tab is THIS AGENT'S holds, not everyone's (2026-09-28). It
  // used to list all five reservations in the dataset, including four held by
  // other agents that this one cannot use - a list where most rows were
  // unusable and nothing on screen said why.
  const heldByAgent = numbers.filter(isHeldForCustomer);
  // The portal's Reserved tab lists what was reserved in this session, not the holds the agent already had.
  const myReserved = portalMode ? numbers.filter((n) => reservedHere.includes(n.msisdn)) : heldByAgent;
  const inTab =
    tab === 'Reserved'
      ? myReserved
      : numbers.filter(
          (n) =>
            n.status === 'AVAILABLE'
              && (tab === 'Free' ? n.priceQAR < FREE_NUMBER_PRICE_CEILING_QAR : n.priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR)
        );

  // When reserved numbers are held, the most recently reserved one is chosen for the agent as the
  // picker opens (on the Reserved tab, which is where it opens). Once, on load. The one exception is a
  // selection that is already one of the held numbers - that is kept - so picking a different reserved
  // number and coming back never flips it. A selection that is NOT a held number (an earlier Star or
  // Free pick left in the draft) is replaced: the agent can still choose any number afterwards.
  const hasDefaultedReserved = useRef(false);
  useEffect(() => {
    if (hasDefaultedReserved.current || !numbersLoaded || portalMode) return;
    const latest = [...myReserved].sort((a, b) => String(b.reservedAt ?? '').localeCompare(String(a.reservedAt ?? '')))[0];
    if (!latest) return;
    hasDefaultedReserved.current = true;
    if (selected && myReserved.some((n) => n.msisdn === selected)) return;
    onSelect(latest.msisdn, chargeFor(latest.priceQAR));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numbersLoaded, myReserved.length]);

  // Star and Free both get a sort control (Free joined 2026-09-30, number-
  // only - see FREE_SORT_OPTIONS). Reserved still gets none: an agent holds
  // at most MAX_RESERVATIONS_PER_AGENT numbers, so there is nothing there
  // worth ranking - see the SortKey doc comment above.
  // Free numbers have no sort control: they are all free, so there is nothing worth ranking (listed by number).
  const showSort = tab === 'Star';

  // Without a control on screen, the order must not depend on whatever the
  // agent last chose on Star or Free.
  const effectiveSort: SortKey = tab === 'Star' ? sort : tab === 'Free' ? freeSort : 'number-asc';

  const trimmedInput = searchInput.trim();
  // Text the mode does not accept (letters for XXYY / Starts With / Ends With, a non-pair for XXYY) is an error and is not searched.
  const searchProblem = showingAllPatterns ? undefined : searchError(trimmedInput, searchMode);
  const wantedSearch = !showingAllPatterns && trimmedInput.length >= SEARCH_MIN && !searchProblem ? trimmedInput : '';
  const searchPending = wantedSearch !== search;
  useEffect(() => {
    if (!searchPending) return;
    const t = window.setTimeout(() => {
      setSearch(wantedSearch);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchPending, wantedSearch]);

  // Everything except the price range, so each range can show how many numbers it would leave.
  // (No search on Reserved - an agent holds at most two numbers - and the box is hidden there, so a leftover query
  // from another tab must not hide a held number.)
  const passesOtherFilters = (n: MsisdnRecord) => {
      if (tab === 'Reserved') return true;
      // Matches the stored E.164 OR the displayed local form, so typing the 8 digits on screen finds the row.
      if (tab === 'Star' && withinEntitlementOnly && entitlementQar !== undefined && n.priceQAR > entitlementQar) return false;
      if (showingAllPatterns) return hasRepeatingPairPattern(n.msisdn);
      return matchesNumberSearch(n, search, searchMode);
  };
  const activeRanges = PRICE_RANGES.filter((r) => priceRanges.includes(r.key));
  const rangeCounts = Object.fromEntries(PRICE_RANGES.map((r) => [r.key, inTab.filter((n) => passesOtherFilters(n) && inPriceRange(n.priceQAR, r)).length]));
  const filtered = inTab
    .filter((n) => tab !== 'Star' || activeRanges.length === 0 || activeRanges.some((r) => inPriceRange(n.priceQAR, r)))
    .filter(passesOtherFilters)
    // Reserved: most recently reserved first. Free and Star keep their chosen sort.
    .sort(tab === 'Reserved' ? (a, b) => String(b.reservedAt ?? '').localeCompare(String(a.reservedAt ?? '')) : SORTERS[effectiveSort]);

  const pageSize = tab === 'Free' ? FREE_PAGE_SIZE : PAGE_SIZE;
  // Clamped rather than reset: deleting a search term can shrink the list under the current page, and snapping to page 1 would lose the agent's
  // place every time they edited the box. (The page maths is the Pagination capability's.)
  const pw = pageWindow(filtered.length, pageSize, page + 1);
  const safePage = pw.page - 1;
  const paged = filtered.slice(pw.from === 0 ? 0 : pw.from - 1, pw.to);

  // One row: the "search by" dropdown, the search box, and (XXYY only) the all-patterns checkbox; it wraps below the box on a narrow toolbar.
  const searchNode = (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
    <div className="flex min-w-0 flex-1 basis-80 items-start gap-2">
      <div className="shrink-0 w-36">
        <Select
          aria-label="Search by"
          options={SEARCH_MODE_OPTIONS}
          className="h-[var(--field-height)] py-0!"
          value={searchMode}
          onChange={(e) => {
            setSearchMode(e.target.value as SearchMode);
            setAllPatterns(false);
            setPage(0);
          }}
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
      <SearchField
        aria-label="Search numbers"
        placeholder={searchMode === 'any' ? 'Search by number or tier (2-8 characters)' : searchMode === 'xxyy' ? 'Enter repeating pairs, e.g. 3344 (2-8 digits)' : 'Enter up to 8 digits'}
        value={searchInput}
        maxLength={SEARCH_MAX}
        disabled={showingAllPatterns}
        className="pr-24 h-[var(--field-height)] py-0!"
        aria-describedby="msisdn-search-hint"
        onChange={(e) => setSearchInput(e.target.value)}
        onClear={() => {
          setSearchInput('');
          setSearch('');
          setPage(0);
        }}
      >
        {/* Typed length (raw, as the field counts it) against the 8-character limit. */}
        <span aria-hidden="true" className={`absolute right-10 top-1/2 -translate-y-1/2 text-[length:var(--fs-caption)] ${showingAllPatterns ? 'text-[var(--field-label-disabled)]' : 'text-muted'}`}>
          {searchInput.length}/{SEARCH_MAX}
        </span>
      </SearchField>
      <p
        id="msisdn-search-hint"
        role={searchProblem ? 'alert' : 'status'}
        className={`empty:hidden text-[length:var(--fs-caption)] ${searchProblem ? 'text-danger' : 'text-muted'}`}
      >
        {searchProblem
          ? searchProblem
          : trimmedInput.length > 0 && trimmedInput.length < SEARCH_MIN
            ? `Enter at least ${SEARCH_MIN} characters`
            : searchPending
              ? 'Searching\u2026'
              : ''}
      </p>
      </div>
    </div>
    {searchMode === 'xxyy' && (
      <label className="flex h-[var(--field-height)] shrink-0 items-center gap-2 whitespace-nowrap cursor-pointer text-fg text-[length:var(--fs-body)]">
        <Checkbox
          checked={allPatterns}
          onChange={(e) => {
            setAllPatterns(e.target.checked);
            setPage(0);
          }}
        />
        Show Me All Available Patterns
      </label>
    )}
    </div>
  );
  // inlineToolbar: the dropdown reads "Sort by" until the agent picks an order (the
  // default order still applies meanwhile), and the separate SORT caption goes.
  const sortPlaceholder = inlineToolbar && !sortChosen[tab === 'Star' ? 'Star' : 'Free'];
  const sortNode = (
        <div className={`flex items-center gap-2 ${inlineToolbar ? 'w-full [&>div]:w-full' : 'justify-end'}`}>
          {!inlineToolbar && <span className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Sort</span>}
          {tab === 'Star' ? (
            <Select
              aria-label="Sort numbers"
              options={STAR_SORT_OPTIONS}
              placeholder="Sort by"
              className="h-[var(--field-height)] py-0!"
              value={sortPlaceholder ? '' : sort}
              onChange={(e) => {
                setSortChosen((c) => ({ ...c, Star: true }));
                setSort(e.target.value as SortKey);
              }}
            />
          ) : (
            <Select
              aria-label="Sort numbers"
              options={FREE_SORT_OPTIONS}
              placeholder="Sort by"
              className="h-[var(--field-height)] py-0!"
              value={sortPlaceholder ? '' : freeSort}
              onChange={(e) => {
                setSortChosen((c) => ({ ...c, Free: true }));
                setFreeSort(e.target.value as 'number-asc' | 'number-desc');
              }}
            />
          )}
        </div>
  );

  return (
    <div className="space-y-3">
      {/* BR-115 entitlement, stated once up front under the step title rather than only on each card that
          exceeds it - the agent should know the cap before scanning individual prices. */}
      {entitlementQar !== undefined && (
        <p className="text-muted text-[length:var(--fs-caption)]">
            Your selected plan entitles a Star Number up to <strong className="text-accent font-bold text-[length:var(--fs-body)]">{`QAR\u00a0${entitlementQar.toLocaleString('en-US')}`}</strong> at no extra charge.
            Anything above that is billed the difference.
        </p>
      )}
      {/* The tabs switch which list is shown, so they are the underline tab strip (navigation / content tabs), not the pill filter switch. */}
      <TabStrip
        items={visibleTabs.map((t) => ({ key: t, label: TAB_LABELS[t] }))}
        active={tab}
        onChange={(t) => {
          setTab(t);
          // Back to the first page: a tab switch is a new list, and landing on page 3 of it would look like missing inventory.
          setPage(0);
        }}
      />
      {/* States the cap up front rather than only on the error that hitting it
          produces - an agent planning a second reservation should be able to
          see they are at the limit before they try. */}
      {tab === 'Reserved' && (
        <div
          role="note"
          className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--info-banner-border)] bg-[var(--info-banner-bg)] px-3 py-2 text-[var(--tint-blue-fg)] text-[length:var(--fs-caption)]"
        >
          <Icon path="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.5h.01" className="w-4 h-4 shrink-0" />
          You can hold a maximum of {MAX_RESERVATIONS_PER_AGENT} reserved numbers at a time.
        </div>
      )}
      {/* Hidden on Reserved (2026-09-28): a customer can hold at most
          MAX_RESERVATIONS_PER_AGENT numbers, so there is nothing to search -
          shown on both Free and Star still, since search narrows by number
          regardless of whether that tab also offers a price sort. */}
      {inlineToolbar ? (
        // The search takes the whole row; the sort sits at the right end of the Price Range row below, in both layouts.
        tab !== 'Reserved' && <div className="min-w-0">{searchNode}</div>
      ) : (
        <>
          {tab !== 'Reserved' && searchNode}

      {/* Sort, right-aligned on its own row - per the 2026-09-26 asset. Narrows
          the same list the search box above it does, so it sits with it
          rather than over the results.

          Star and Free both show this now (2026-09-30) - see showSort's own
          note. Free's own menu is number-only (FREE_SORT_OPTIONS): a price
          sort would rank Free rows by a figure the customer never pays.
          Reserved still has none: no price ranking worth showing a control
          for, and an empty control row would leave a gap the agent reads as
          something having failed to load. */}
      {/* Tier chips (Platinum / Gold / Silver) and the TIER filter were removed
          on 2026-09-27 per the annotated walkthrough. */}
          {/* On the Star tab the sort shares the price-range row below (the portal layout); elsewhere it keeps its own row. */}
          {showSort && tab !== 'Star' && sortNode}
        </>
      )}
      {/* Star tab: "Show within my entitlement" filter, with the other Star-tab filters. */}
      {tab === 'Star' && entitlementQar !== undefined && (
        <label className="flex w-fit items-center gap-2 cursor-pointer text-fg text-[length:var(--fs-body)]">
          <Checkbox
            checked={withinEntitlementOnly}
            onChange={(e) => {
              setWithinEntitlementOnly(e.target.checked);
              setPage(0);
            }}
          />
          Show within my entitlement
        </label>
      )}
      {/* Star tab: price-range filter. One range at a time (picking another replaces it; picking the active one again, or All, clears it); "All" (the default) means none. Counts
          ignore the range filter itself but follow search and the entitlement filter, and a range with no
          matches is disabled. */}
      {tab === 'Star' && (
        <div className="space-y-2" role="group" aria-label="Price range">
          <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-fg-2 text-[length:var(--fs-caption)]">Price Range</span>
            {[{ key: 'all', label: 'All' }, ...PRICE_RANGES].map((r) => {
              const isAll = r.key === 'all';
              const on = isAll ? priceRanges.length === 0 : priceRanges.includes(r.key);
              const count = isAll ? undefined : rangeCounts[r.key];
              const disabled = !isAll && count === 0 && !on;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  title={isAll ? undefined : rangeTitle(r as (typeof PRICE_RANGES)[number])}
                  disabled={disabled}
                  onClick={() => {
                    setPage(0);
                    setPriceRanges((cur) => (isAll || cur.includes(r.key) ? [] : [r.key]));
                  }}
                  className={`rounded-[var(--radius-pill)] border px-3 py-1 text-[length:var(--fs-caption)] focus:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed ${
                    on
                      ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] text-[var(--field-card-selected)] font-medium'
                      : 'border-[var(--field-card-border)] bg-bg text-fg-2 enabled:hover:bg-surface'
                  }`}
                >
                  {on && !isAll ? '\u2713 ' : ''}
                  {r.label}
                  {count !== undefined ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
          {/* Sort stays at the right end of the Price Range row (the chips wrap among themselves, not under it), in the portal and in the inline toolbar. */}
          {showSort && <div className={inlineToolbar ? 'w-56 shrink-0' : 'shrink-0'}>{sortNode}</div>}
          </div>
          {(activeRanges.length > 0 || withinEntitlementOnly || search || showingAllPatterns) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg-2 text-[length:var(--fs-caption)]">Active Filters</span>
              {showingAllPatterns && (
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-2.5 py-0.5 text-[length:var(--fs-caption)] text-fg">
                  All XXYY Patterns
                  <button
                    type="button"
                    aria-label="Remove filter All XXYY Patterns"
                    onClick={() => { setAllPatterns(false); setPage(0); }}
                    className="text-fg-2 hover:text-fg focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-pill)]"
                  >
                    <Icon path="M18 6L6 18 M6 6l12 12" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {activeRanges.map((r) => (
                <span key={r.key} className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-2.5 py-0.5 text-[length:var(--fs-caption)] text-fg">
                  {r.label}
                  <button
                    type="button"
                    aria-label={`Remove filter ${r.label}`}
                    onClick={() => setPriceRanges((cur) => cur.filter((k) => k !== r.key))}
                    className="text-fg-2 hover:text-fg focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-pill)]"
                  >
                    <Icon path="M18 6L6 18 M6 6l12 12" className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <Button variant="tertiary" compact onClick={() => { setPriceRanges([]); setWithinEntitlementOnly(false); setSearch(''); setSearchInput(''); setSearchMode(DEFAULT_SEARCH_MODE); setAllPatterns(false); setPage(0); }}>
                Clear filters
              </Button>
            </div>
          )}
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
        className={`grid gap-4 ${
          // Free and Star numbers are compact cards (2026-10-04 designs). Star cards are at least 19rem wide so the price and the
          // lock-in period fit side by side without clipping (they were 15.5rem and cut "QAR 35,000" short). Reserved carries more lines per card (who holds it, when) and keeps two.
          // Columns follow the width of the panel the picker sits in (auto-fill), not the window: the wizard's step card is
          // 746px narrower than the window, so a viewport breakpoint squeezed the cards at 1024.
          // The wide template applies whenever ANY card on the page is a Star card: a Reserved list mixing Free and Star numbers used to take the
          // narrow one, which squeezed its Star cards until the number, price and lock-in overflowed.
          tab === 'Star' || (tab === 'Reserved' && paged.some((n) => n.priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR))
            ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]'
            : tab === 'Free'
              ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))]'
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
          // Click anywhere on the card to select it; click again to unselect.
          const toggle = () => (isSelected && onDeselect ? onDeselect() : choose(n.msisdn, chargeFor(n.priceQAR)));
          const isStar = n.priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR;
          // Portal Reserved tab: release the number. stopPropagation keeps the click from selecting the card.
          const unreserve =
            portalMode && tab === 'Reserved' && onUnreserve ? (
              <div className="relative">
                <Button
                  variant="secondary"
                  compact
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnreserve(n.msisdn);
                  }}
                >
                  Unreserve
                </Button>
              </div>
            ) : null;
          // Upfront charge is what is actually billed today: for a Star number
          // only the amount above the plan's entitlement (BR-115); anything
          // below the Star band is billed at its catalogue price.
          const upfront =
            isStar && planMrcQar !== undefined ? starNumberOverageQar(planMrcQar, n.priceQAR, entitlementQar) : chargeFor(n.priceQAR);
          const lockIn = isStar
            ? starTiers.find((t) => n.priceQAR >= t.valueRangeMin && n.priceQAR <= t.valueRangeMax)?.lockInDurationMonths
            : undefined;
          const tag = isStar ? (
            // The price of a Star number, amber to set it apart from free and charged ones.
            <Badge variant="tag-amber">{formatQar(n.priceQAR)}</Badge>
          ) : null; // A free number carries no pill: it is simply the number.
          if (tab === 'Star' || (tab === 'Reserved' && isStar)) {
            // Star-number card (2026-10-04 design): the number and a state mark on top, then a 2x2 grid of
            // icon-tile facts - Price, Lock-in, Upfront charge (only when there is one).
            // Non-breaking spaces keep "QAR 8,750" and "24 months" together: a long value wraps between words, never inside one.
            const money = (v: number) => formatQar(v, { nbsp: true });
            const facts = [
              { icon: STAT_ICONS.wallet, label: 'Price', value: money(n.priceQAR), alert: false },
              ...(lockIn !== undefined ? [{ icon: STAT_ICONS.lock, label: 'Lock-In Period', value: `${lockIn}\u00a0months`, alert: false }] : []),
              ...(planMrcQar !== undefined && upfront > 0
                ? [{ icon: STAT_ICONS.tag, label: 'Upfront Charge', value: money(upfront), alert: true }]
                : []),
            ];
            return (
              <div
                key={n.msisdn}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={`relative isolate overflow-hidden flex flex-col gap-3 rounded-[var(--radius-card)] border px-6 py-5 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                  isSelected ? CARD_SELECTED : CARD_IDLE
                }`}
              >
                {isSelected && <SelectedCardTexture />}
                {/* The state mark: a ring when free to pick, a red tick when selected (also exposed as aria-pressed). */}
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] border ${
                    isSelected ? 'border-accent bg-accent text-on-dark' : 'border-[var(--field-border)] bg-bg'
                  }`}
                >
                  {isSelected && <Icon path="M20 6L9 17l-5-5" className="w-4 h-4" strokeWidth={3} />}
                </span>
                <p className="font-bold text-[length:var(--fs-h4)] text-fg leading-tight pr-10">{toLocalMsisdn(n.msisdn)}</p>
                {/* The facts sit side by side while the card has room for two and stack when it does not (a narrow panel, a phone), never overflow. */}
                <div className="relative grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-x-6 gap-y-4">
                  {facts.map((f) => (
                    <StarStat key={f.label} label={f.label} value={f.value} alert={f.alert} plainValue={f.label === 'Lock-in period'} />
                  ))}
                </div>
                {unreserve}
              </div>
            );
          }
          // Compact card: the number on the left and its price on the right of one row (the price wraps
          // below, never truncating either, when the card is too narrow for both), then its charge lines.
          return (
            <div
              key={n.msisdn}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle();
                }
              }}
              className={`relative isolate flex flex-col gap-1.5 rounded-[var(--radius-card)] border px-4 py-3 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                isSelected ? CARD_SELECTED : CARD_IDLE
              }`}
            >
              {isSelected && <SelectedCardTexture />}
              {/* Selected is shown by more than the fill: a red border and ring (CARD_SELECTED) and a tick
                  badge. Nothing marks an unselected card. The state is exposed to assistive tech through
                  aria-pressed on the card. */}
              {isSelected && (
                <span aria-hidden="true" className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-pill)] bg-accent text-on-dark ring-2 ring-bg">
                  <Icon path="M20 6L9 17l-5-5" className="w-3 h-3" strokeWidth={3} />
                </span>
              )}
              {/* On the selected surface the green FREE pill text is darkened (#1f6b2c, about 6:1) to keep 4.5:1. */}
              <div className={`relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${isSelected ? '[&_.text-success]:text-[var(--tint-green-fg)]' : ''}`}>
                <p className="font-bold text-[length:var(--fs-h5,20px)] text-fg whitespace-nowrap">{toLocalMsisdn(n.msisdn)}</p>
                {tag}
              </div>
              {tab === 'Reserved' && n.reservedAt && (
                <p className="text-fg-2 text-[length:var(--fs-caption)]">
                  Reserved {formatDateTime(n.reservedAt)}
                </p>
              )}
              {isStar ? (
                <>
                  {planMrcQar !== undefined && upfront > 0 && (
                    <p className="font-semibold text-accent text-[length:var(--fs-caption)]">Upfront charge: {formatQar(upfront)}</p>
                  )}
                  {planMrcQar !== undefined && entitlementQar !== undefined && (
                    <p className="text-fg-2 text-[length:var(--fs-caption)]">Plan entitlement: up to {formatQar(entitlementQar)}</p>
                  )}
                  {lockIn !== undefined && <p className="text-fg-2 text-[length:var(--fs-caption)]">Lock-in period: {lockIn} months</p>}
                </>
              ) : null}
              {unreserve}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted text-[length:var(--fs-body)] col-span-full">
            {tab === 'Reserved'
              ? portalMode
                ? 'No numbers reserved yet. Numbers you reserve here appear in this tab.'
                : 'You have no reserved numbers.'
              : activeRanges.length > 0 && tab === 'Star'
                ? 'No Star Numbers match the selected price range and filters. Clear the filters to see all.'
                : showingAllPatterns
                  ? 'No available numbers have an XXYY pattern.'
                  : search
                  ? `No available numbers match \u201c${search}\u201d.`
                  : 'No available numbers in this category.'}
          </p>
        )}
      </div>
      {/* Paged by the Pagination capability (previous, numbered pages, next, under a "Showing a-b of N" count): every journey, the portal and the
          Capability Library page the numbers the same way. Hidden entirely on a single page so a one-page list carries no dead controls. */}
      <Pagination page={safePage + 1} total={filtered.length} pageSize={pageSize} onPage={(p) => setPage(p - 1)} />
    </div>
  );
}
