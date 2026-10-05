import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Modal } from '../../components/primitives/Modal';
import { Icon } from '../../components/primitives/Icon';
import { OfferDetailsDrawer } from './OfferDetailsDrawer';
import type { OfferProduct } from '../../components/patterns/offerCardParts';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, OfferArtwork, STAR_ICON, planFeatureRows } from '../../components/patterns/offerCardParts';
import { callService, ServiceError, MAX_RETRIES, type FailureKind } from '../../engines/serviceCall';
import { TechnicalFailure, ValidationStatus } from '../../components/patterns/ValidationStatus';
import { CompanySearchInput } from '../../components/domain/CompanySearchInput';
import type { CompanySelection } from '../../components/domain/CompanySearchInput';
import { QidImageUpload } from '../../components/domain/QidImageUpload';
import { SupportingDocumentUpload } from '../../components/domain/SupportingDocumentUpload';
import type { QidImageUploadValue } from '../../components/domain/QidImageUpload';
import { create } from 'zustand';
import { EligibilityChecksList, buildEligibilityRows } from '../../components/domain/EligibilityGateStep';
import type { EligibilityRow } from '../../components/domain/EligibilityGateStep';
import { evaluateEligibilityChecks } from '../../engines/eligibilityEngine';
import type { EligibilityContext } from '../../engines/eligibilityEngine';
import { evaluateRule } from '../../engines/ruleEngine';
import { useNotificationStore } from '../../stores/notificationStore';
import type { EligibilityResult } from '../../components/domain/EligibilityGateStep';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { mockDataUrl } from '../../engines/mockDataEngine';

// Building blocks for the New Connection journey. Everything here is a
// journey-level decision (who the customer is, which offer, which service);
// the fulfilment steps themselves reuse the shared patterns directly.

const CARD = 'rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4';
// Selectable cards: geometry only. The colours come from the selected/unselected
// branch, because CARD's own border-border-soft + bg-bg would otherwise compete
// with the selected tokens (equal specificity, so stylesheet order decides).
const CARD_SELECTABLE = 'rounded-[var(--radius-card)] border p-4';

// ---------------------------------------------------------------- Service journeys

export type ServiceJourney =
  | 'new-prepaid'
  | 'new-postpaid'
  | 'mnp-postpaid'
  | 'mnp-prepaid'
  | 'new-fixed-line'
  | 'new-fwa';

export const SERVICE_JOURNEYS: { key: ServiceJourney; label: string; description: string; route?: string }[] = [
  { key: 'new-prepaid', label: 'New Prepaid', description: 'Activate a new prepaid SIM and starter bundle', route: '/mobile-prepaid/new-prepaid-tablet-step-1-contact-id-capture' },
  { key: 'new-postpaid', label: 'New Postpaid', description: 'Activate a new postpaid line with plan and SIM' },
  { key: 'mnp-postpaid', label: 'MNP Postpaid', description: 'Port a number in onto a postpaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'mnp-prepaid', label: 'MNP Prepaid', description: 'Port a number in onto a prepaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'new-fixed-line', label: 'New Fixed Line', description: 'Activate a new fixed line service', route: '/fixed-line-fibre/new-fixed-line-wizard-contact-step' },
  { key: 'new-fwa', label: 'New FWA', description: 'Activate a new Fixed Wireless Access service', route: '/fwa-5g-home/new-fwa-tile-home-screen' },
];

/** Offer-card service pill colours, one per service so the type reads at a glance. Self-contained
 * tint + dark text pairs (each text/background >= 4.5:1), so they hold in the dark theme too. Red is
 * left out: it already marks the Recommended flag and the selected card. */
const JOURNEY_PILL: Record<ServiceJourney, string> = {
  'new-postpaid': 'bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)]',
  'new-prepaid': 'bg-[var(--tint-green-bg)] text-[var(--tint-green-fg)]',
  'mnp-postpaid': 'bg-[var(--tint-teal-bg)] text-[var(--tint-teal-fg)]',
  'mnp-prepaid': 'bg-[var(--tint-amber-bg)] text-[var(--tint-amber-fg)]',
  'new-fixed-line': 'bg-[var(--tint-pink-bg)] text-[var(--tint-pink-fg)]',
  'new-fwa': 'bg-[var(--tint-indigo-bg)] text-[var(--tint-indigo-fg)]',
};

export const journeyLabel = (k: ServiceJourney | undefined) => SERVICE_JOURNEYS.find((j) => j.key === k)?.label;

/** Only New Postpaid continues inside this wizard (its fulfilment steps are the
 * ones below); every other journey continues in its own existing wizard. */
export const continuesHere = (k: ServiceJourney | undefined) => k === 'new-postpaid';

function HandOff({ journey, onGo }: { journey: ServiceJourney; onGo: (route: string) => void }) {
  const j = SERVICE_JOURNEYS.find((x) => x.key === journey);
  if (!j?.route) return null;
  return (
    <div className={`${CARD} space-y-2`}>
      <p className="text-fg text-[length:var(--fs-body)]">
        <strong>{j.label}</strong> continues in its own journey - this customer has already been identified and validated here.
      </p>
      <Button variant="primary-rect" compact onClick={() => onGo(j.route!)}>
        Continue in {j.label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Existing / new customer

/** An identity that resolves to a customer record is ALWAYS an existing customer - including one with no
 * active lines or services. Nothing is announced for it any more (the "Existing customer" toast was
 * removed 2026-10-04): the status shows through the rest of the journey. Kept as a component so its call
 * sites need no change. */
export function CustomerStatusBanner(_props: { customerId: string | undefined }) {
  return null;
}

// ---------------------------------------------------------------- Customer type

export type CustomerType = 'none' | 'b2b2c' | 'retired' | 'mada';

export interface CustomerTypeValue {
  type?: CustomerType;
  company?: CompanySelection;
  officeId?: QidImageUploadValue;
  /** The agent has reviewed and accepted the supporting document (scanned or uploaded). Cleared by any retake or new upload. */
  officeAccepted?: boolean;
  /** The supporting document was uploaded instead of scanned (file name and size only). */
  evidenceUpload?: { fileName: string; sizeBytes: number };
  /** The agent rejected the benefit: the customer continues as Standard, and an employer on the MOI record no longer makes the order B2B2C. */
  rejected?: boolean;
  /** Retired: result of sending the extracted ID number to the government
   * system once the office ID has been scanned. */
  govValidation?: { status: 'checking' | 'passed' | 'failed' | 'error'; message?: string; kind?: FailureKind };
  /** Failed technical attempts at the government check so far (drives Retry vs. the controlled fallback). */
  govAttempts?: number;
}

/**
 * Sends the ID number extracted from the scan to the government system and
 * reports whether it is a valid retiree. SIMULATED: there is no such service
 * in this app, so it reads public/mock-data/govt-retiree-registry.json after a
 * short delay (see that file's _note).
 */
// How long the simulated government check takes (ms).
const GOVT_VALIDATION_DELAY_MS = 3000;

/** Job title that approves a manually-entered identity. There is no separate "Store Manager" title in the agent directory; Sales Manager is the store-level approver (it already approves MNP port-ins). */
export const STORE_MANAGER_ROLE = 'Sales Manager';

/** Job title that approves an order held for an active-postpaid-line limit. The directory has no "Collection Team" title; Credit Control Agent is its collections role. */
export const COLLECTION_TEAM_ROLE = 'Credit Control Agent';

/**
 * Resolves with a BUSINESS result (the system answered: retiree confirmed or not), or
 * throws ServiceError when the system gave no usable answer (unreachable, timed out,
 * non-OK response, malformed or incomplete body). The caller must never turn a
 * ServiceError into "not a retiree".
 */
async function validateRetiredWithGovernment(idNumber: string | undefined): Promise<{ status: 'passed' | 'failed'; message: string }> {
  await callService('govt-retiree', async () => {
    await new Promise((r) => setTimeout(r, GOVT_VALIDATION_DELAY_MS));
  }, GOVT_VALIDATION_DELAY_MS + 8000);
  if (!idNumber) return { status: 'failed', message: 'No ID number could be read from the scan.' };
  const data = await callService('govt-retiree', async () => {
    const res = await fetch(mockDataUrl('govt-retiree-registry'));
    if (!res.ok) throw new ServiceError('govt-retiree', 'api');
    let body: { retiredIdNumbers?: unknown };
    try {
      body = (await res.json()) as { retiredIdNumbers?: unknown };
    } catch {
      throw new ServiceError('govt-retiree', 'partial');
    }
    // An answer without the list is incomplete - not "nobody is retired".
    if (!Array.isArray(body.retiredIdNumbers)) throw new ServiceError('govt-retiree', 'partial');
    return body.retiredIdNumbers as string[];
  });
  return data.includes(idNumber)
    ? { status: 'passed', message: 'Retired status validated with the government system.' }
    : { status: 'failed', message: 'This ID number could not be validated as a retired customer with the government system.' };
}

const TYPE_OPTIONS: { key: CustomerType; label: string; description: string }[] = [
  { key: 'none', label: 'Standard customer', description: 'None of B2B2C, Retired or MADA applies' },
  { key: 'b2b2c', label: 'B2B2C', description: 'Employee of a supported partner company' },
  { key: 'retired', label: 'Retired', description: 'Agent validates the applicable information' },
  { key: 'mada', label: 'MADA', description: 'Agent validates the applicable information' },
];

export const customerTypeLabel = (t: CustomerType | undefined) => TYPE_OPTIONS.find((o) => o.key === t)?.label;

/** A company counts as found and supported when it is in the enterprise-accounts
 * registry; "Add new company" (companyIsNew) is not a supported company. */
export const isCompanySupported = (c: CompanySelection | undefined) => Boolean(c?.companyAccountId) && !c?.companyIsNew;

export function isCustomerTypeValid(v: CustomerTypeValue | undefined): boolean {
  if (!v?.type) return false;
  if (v.type === 'none') return true;
  // Evidence is a scanned OR an uploaded supporting document, and the agent must have accepted it.
  const scanned = Boolean(((v.officeId?.frontScanned && v.officeId?.backScanned) || v.evidenceUpload) && v.officeAccepted);
  if (v.type === 'b2b2c') return isCompanySupported(v.company) && scanned;
  if (v.type === 'retired') return scanned && v.govValidation?.status === 'passed';
  return scanned;
}

export function CustomerTypeStep({
  value,
  onChange,
  derivedCompany,
  idNumber,
  onReject,
}: {
  value: CustomerTypeValue;
  onChange: (v: CustomerTypeValue) => void;
  /** Employer already on the MOI record, offered as the B2B2C starting point. */
  derivedCompany?: CompanySelection;
  /** The ID number read from the scan - what a Retired check sends to the government system. */
  idNumber?: string;
  /** Reject: decline the benefit, classify as Standard and continue the journey. */
  onReject?: () => void;
}) {
  // Standard customer is the default. An employer on the MOI record is not
  // selected for the agent - it only prefills the company if they choose B2B2C.
  useEffect(() => {
    if (value.type) return;
    onChange({ type: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const type = value.type;

  // Retired: the moment the office ID scan completes, send the extracted ID
  // number to the government system. Re-runs after a retake because changing
  // the scan clears the previous result (see the officeId onChange below).
  const officeScanned = Boolean(((value.officeId?.frontScanned && value.officeId?.backScanned) || value.evidenceUpload) && value.officeAccepted);
  // The in-flight check is invalidated only when the thing it validates changes
  // (type, or the scan/acceptance), NOT when its own 'checking' state lands - an
  // effect cleanup keyed on govValidation cancelled the result it had just asked
  // for, leaving "Validating…" on screen forever.
  const checkId = useRef(0);
  const latestValue = useRef(value);
  latestValue.current = value;
  useEffect(() => () => void (checkId.current += 1), [type, officeScanned]);
  useEffect(() => {
    if (type !== 'retired' || !officeScanned || value.govValidation) return;
    const id = ++checkId.current;
    onChange({ ...latestValue.current, govValidation: { status: 'checking' } });
    validateRetiredWithGovernment(idNumber)
      .then((r) => {
        if (checkId.current !== id) return; // superseded or interrupted: not this check's result
        onChange({ ...latestValue.current, govValidation: r, govAttempts: 0 });
      })
      .catch((err) => {
        if (checkId.current !== id) return;
        // The system gave no usable answer: UNRESOLVED, never "not a retiree".
        const kind = err instanceof ServiceError ? err.kind : 'unexpected';
        onChange({
          ...latestValue.current,
          govValidation: { status: 'error', kind },
          govAttempts: (latestValue.current.govAttempts ?? 0) + 1,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, officeScanned, value.govValidation === undefined]);

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Additional discounts" className="grid gap-3 sm:grid-cols-3">
        {OPTION_CARDS(value, onChange, derivedCompany)}
      </div>

      {type === 'b2b2c' && (
        <div className={`${CARD} space-y-3`}>
          <CompanySearchInput
            label="Company name"
            allowAddNew={false}
            value={value.company ?? {}}
            onChange={(company) => onChange({ ...value, company })}
          />
          {value.company?.companyName && (
            isCompanySupported(value.company) ? null : (
              <p className="text-danger text-[length:var(--fs-caption)]">
                This company is not in the supported company list, so B2B2C cannot continue. Choose another customer type.
              </p>
            )
          )}
        </div>
      )}

      {type && type !== 'none' && (type !== 'b2b2c' || isCompanySupported(value.company)) && (
        <div className="space-y-5">
          {/* Scan and Upload sit side by side - two equal options for the same evidence. */}
          <div className="grid gap-4 sm:grid-cols-2 items-stretch">
          <div className="flex flex-col gap-2 min-w-0">
          <p className="text-fg font-semibold text-[length:var(--fs-body)]">Scan Document</p>
          <div className={EQUAL_CARD}>
          <QidImageUpload
            documentType="Office ID"
            variant={type === 'b2b2c' || type === 'retired' || type === 'mada' ? type : undefined}
            value={value.officeId ?? {}}
            // Scanning replaces any uploaded document: the evidence is one or the other.
            onChange={(officeId) => onChange({ ...value, officeId, evidenceUpload: undefined, officeAccepted: false, govValidation: undefined, govAttempts: 0 })}
            accepted={value.officeAccepted}
            onAccept={() => onChange({ ...value, officeAccepted: true })}
            // Reject declines the benefit and returns to a Standard customer, so no
            // B2B2C/Retired/MADA benefit is carried without its office ID.
            onReject={() => (onReject ? onReject() : onChange({ type: 'none', rejected: true }))}
          />
          </div>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-fg font-semibold text-[length:var(--fs-body)]">Upload Document</p>
            <div className={EQUAL_CARD}>
            <SupportingDocumentUpload
              value={value.evidenceUpload}
              // Uploading replaces any scan (the evidence is one or the other) and needs no
              // separate Accept: the uploaded document counts as soon as it is there, and
              // Remove takes it back.
              onChange={(doc) => onChange({ ...value, evidenceUpload: doc, officeId: undefined, officeAccepted: Boolean(doc), govValidation: undefined, govAttempts: 0 })}
            />
            </div>
          </div>
          </div>
          {type === 'retired' && value.govValidation?.status === 'checking' && (
            (value.govAttempts ?? 0) > 0 ? (
              <TechnicalFailure service="govt-retiree" kind="unexpected" attempts={value.govAttempts ?? 0} retrying />
            ) : (
              <ValidationStatus variant="pending" title="Validating the ID number with the government system…">
                The retired status is not confirmed until this completes.
              </ValidationStatus>
            )
          )}
          {type === 'retired' && value.govValidation?.status === 'passed' && (
            <ValidationStatus variant="success" title={value.govValidation.message ?? 'Retired status validated.'} />
          )}
          {type === 'retired' && value.govValidation?.status === 'failed' && (
            <ValidationStatus
              variant="business-failure"
              title="Retired status not validated"
              actions={
                <Button variant="secondary-rect" compact onClick={() => onChange({ type: 'none' })}>
                  Continue as standard customer
                </Button>
              }
            >
              {value.govValidation.message} The customer can continue as a standard customer.
            </ValidationStatus>
          )}
          {type === 'retired' && value.govValidation?.status === 'error' && (
            <TechnicalFailure
              service="govt-retiree"
              kind={value.govValidation.kind ?? 'unexpected'}
              attempts={value.govAttempts ?? 1}
              // Retry re-asks the same question for the same scan; the stale-check guard
              // keeps an older answer from landing on top of it.
              onRetry={() => onChange({ ...value, govValidation: undefined })}
              exhaustedHint={
                <>
                  Retired status could not be verified, so the discount cannot be applied. Use <strong>Reject</strong> to continue as a Standard customer, or Save &amp; Exit to resume later.
                </>
              }
              extraActions={
                (value.govAttempts ?? 1) >= MAX_RETRIES ? (
                  <Button variant="secondary-rect" compact onClick={() => onChange({ type: 'none', rejected: true })}>
                    Continue as standard customer
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Makes the Scan and Upload cards the same height: the card fills its column and its main area grows to fill the card. */
const EQUAL_CARD = 'flex-1 [&>div]:h-full [&>div>div:first-child]:flex-1';

const TYPE_ICONS: Partial<Record<CustomerType, string>> = {
  b2b2c: 'M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2',
  retired: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v4l2 1',
  mada: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3',
};
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7.5';

function OPTION_CARDS(value: CustomerTypeValue, onChange: (v: CustomerTypeValue) => void, derivedCompany?: CompanySelection) {
  // Standard customer is not a card: it is what applies when none of the
  // special types is selected. Clicking the selected card again deselects it.
  return TYPE_OPTIONS.filter((o) => o.key !== 'none').map((o) => {
    const checked = value.type === o.key;
    // Switching type discards what belonged to the previous one, so a stale
    // company or office-ID scan cannot ride along into the new type.
    const choose = () => checked ? onChange({ type: 'none' }) : onChange({ type: o.key, company: o.key === 'b2b2c' ? (value.company ?? (derivedCompany?.companyName ? derivedCompany : undefined)) : undefined });
    return (
      // The whole card is the control (no radio circle): selected state is the
      // red border + tint, announced as a radio via role/aria-checked.
      <div
        key={o.key}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={choose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose();
          }
        }}
        className={`${CARD_SELECTABLE} cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${checked ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'}`}
      >
        <div className="flex items-center gap-3">
          {/* Icon tile: tinted at rest, solid accent when selected. */}
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-button)] transition-colors ${checked ? 'bg-accent text-accent-on' : 'bg-surface-warm text-accent'}`}
          >
            <Icon path={TYPE_ICONS[o.key] ?? CHECK_ICON} className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1 text-fg font-medium text-[length:var(--fs-body)]">{o.label}</span>
          {/* Selection mark: a ring at rest, a filled tick once selected. */}
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-circle)] border ${checked ? 'border-transparent bg-accent text-accent-on' : 'border-[var(--field-card-border)] bg-bg'}`}
          >
            {checked && <Icon path={CHECK_ICON} className="w-3 h-3" strokeWidth={3} />}
          </span>
        </div>
      </div>
    );
  });
}

// ---------------------------------------------------------------- Cross-sales offers

export interface CrossSalesValue {
  decision?: 'accepted' | 'declined' | 'none';
  offerId?: string;
  offerName?: string;
  journey?: ServiceJourney;
  linkedProductIds?: string[];
}

interface Offer {
  offerId: string;
  offerName: string;
  offerDescription: string;
  monthlyRental: number;
  campaignCode: string;
  status: string;
  contactId: string;
  serviceJourney?: ServiceJourney;
  linkedProductIds: string[];
  /** Campaign facts shown only in the details drawer. */
  offerType?: string;
  priorityCode?: string;
  treatmentCode?: string;
  channel?: string;
  promotionId?: string;
  price?: number;
  addOnMonthly?: number;
}

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';


/** Up to four facts about the plan an offer opens, read from the linked product - never typed in here. */
function offerFeatures(o: Offer, products: Record<string, OfferProduct>) {
  const plan = o.linkedProductIds.map((id) => products[id]).find((p) => p && (p.dataAllowanceGB || p.minutesAllowance || p.speedTierMbps));
  return planFeatureRows(plan);
}

/** The one line the drawer's banner leads with: the linked plan's first free benefit, else its headline allowance. */
function offerHighlight(o: Offer, products: Record<string, OfferProduct>): { title: string; subtitle: string } | null {
  const plan = o.linkedProductIds.map((id) => products[id]).find((p) => p && (p.benefits?.length || p.dataAllowanceGB || p.speedTierMbps));
  if (!plan) return null;
  const title =
    plan.benefits?.[0] ??
    (plan.speedTierMbps ? `${plan.speedTierMbps} Mbps fibre${plan.iptvIncluded ? ' with IPTV' : ''}` : `${plan.dataAllowanceGB} GB data`);
  return { title, subtitle: `Included with ${plan.name}` };
}


export function CrossSalesStep({
  customerId,
  value,
  onChange,
  onHandOff,
}: {
  customerId: string | undefined;
  value: CrossSalesValue;
  onChange: (v: CrossSalesValue) => void;
  onHandOff: (route: string) => void;
}) {
  const [offers, setOffers] = useState<Offer[] | undefined>();
  // The offer whose comprehensive details are open in the side drawer.
  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  const [products, setProducts] = useState<Record<string, OfferProduct>>({});
  useEffect(() => {
    mockDataEngine
      .list<OfferProduct>('products')
      .then((all) => setProducts(Object.fromEntries(all.map((p) => [p.productId, p]))));
  }, []);
  const productNames = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.name]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, contacts] = await Promise.all([
        mockDataEngine.list<Offer>('cross-sales-offers'),
        mockDataEngine.list<{ contactRecordId: string; customerId: string }>('customer-contacts'),
      ]);
      const mine = new Set(contacts.filter((c) => c.customerId === customerId).map((c) => c.contactRecordId));
      // Open offers for this customer, for a journey this flow supports.
      const open = all.filter((o) => mine.has(o.contactId) && (o.status === 'Offered' || o.status === 'Interested') && o.serviceJourney);
      if (!cancelled) setOffers(open);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Nothing on offer is its own outcome, not an empty state to sit in.
  useEffect(() => {
    if (offers && offers.length === 0 && value.decision !== 'none') onChange({ decision: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  if (!offers) return <p className="text-muted text-[length:var(--fs-body)]">Checking for cross-sales offers…</p>;
  if (offers.length === 0) {
    return (
      <div className={CARD}>
        <p className="text-fg font-semibold text-[length:var(--fs-body)]">No cross-sales offer available</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">Continue to choose a service from the standard catalogue.</p>
      </div>
    );
  }

  const accepted = offers.find((o) => o.offerId === value.offerId && value.decision === 'accepted');
  // One offer carries the Recommended flag: the best (lowest) priority code, first listed on a tie.
  const recommendedId = [...offers].sort((x, y) => (x.priorityCode ?? 'P9').localeCompare(y.priorityCode ?? 'P9'))[0]?.offerId;
  return (
    <div className="space-y-4">
      {/* One row per service (Postpaid, Prepaid, GigaHome...), in order of first appearance. */}
      <div className="space-y-3" role="radiogroup" aria-label="Offers">
        {[null].map((all) => (
          <ul key={String(all)} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {offers.map((o) => {
          const selected = value.decision === 'accepted' && value.offerId === o.offerId;
          const recommended = o.offerId === recommendedId;
          const perMonth = !(o.serviceJourney === 'new-prepaid' || o.serviceJourney === 'mnp-prepaid');
          const features = offerFeatures(o, products);
          // The whole card is the control: click (or Enter/Space) selects it,
          // and clicking the selected one again clears it.
          const toggle = () =>
            onChange(
              selected
                ? {}
                : { decision: 'accepted', offerId: o.offerId, offerName: o.offerName, journey: o.serviceJourney, linkedProductIds: o.linkedProductIds }
            );
          return (
            <li
              key={o.offerId}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }}
              className={`relative rounded-[var(--radius-card)] border p-5 flex flex-col gap-3 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                selected ? CARD_SELECTED : recommended ? CARD_HIGHLIGHT : CARD_IDLE
              }`}
            >
              {/* Top row: the Recommended flag on the left, the service on the right. Both
                  always take their space (the flag is hidden, not removed) so every card's
                  title starts at the same height. */}
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent text-white px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${recommended ? '' : 'invisible'}`}
                  aria-hidden={!recommended}
                >
                  <Icon path={STAR_ICON} className="w-3 h-3" />
                  Recommended
                </span>
                <span
                  className={`rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${
                    o.serviceJourney ? JOURNEY_PILL[o.serviceJourney] : 'bg-surface text-fg-2'
                  }`}
                >
                  {journeyLabel(o.serviceJourney)}
                </span>
              </div>
              <OfferArtwork />
              <div className="flex-1 space-y-2">
                <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug pr-20">{o.offerName}</p>
                <p className="text-fg-2 text-[length:var(--fs-caption)] pr-20">{o.offerDescription}</p>
                <p className="text-accent">
                  <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                  <span className="text-[length:var(--fs-h3)] font-bold">{o.monthlyRental}</span>
                  {perMonth && <span className="text-fg-2 text-[length:var(--fs-caption)]"> /month</span>}
                </p>
                <ul className="space-y-1.5">
                  {features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-fg-2 text-[length:var(--fs-caption)]">
                      <Icon path={f.icon} className="w-4 h-4 shrink-0 text-accent" />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                {/* Opens the full offer details in the side drawer; it stops
                    propagation so looking never selects the offer. */}
                <button
                  type="button"
                  aria-label={`View details for ${o.offerName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailOffer(o);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-button)] text-fg hover:text-accent focus:outline-none focus-visible:shadow-[var(--focus-ring)] text-[length:var(--fs-caption)] font-medium"
                >
                  View details
                  <Icon path={CHEVRON_RIGHT} className="w-4 h-4" />
                </button>
                {/* Presentational: the card is the control, so the button must not take focus or
                    fire a second toggle. */}
                <Button
                  variant={selected ? 'primary-rect' : 'ghost-rect'}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                >
                  {selected ? 'Selected' : 'Select offer'}
                </Button>
              </div>
            </li>
          );
        })}
          </ul>
        ))}
      </div>
      {/* The hand-off banner only exists for offers that continue in another journey (MNP, fixed line),
          so rendering it conditionally made the footer and page jump ~120px whenever the selection
          moved between a postpaid offer and one of those. The slot is always present at the banner's
          own height (105px, measured), so nothing below it moves. */}
      <div className="min-h-[105px]">
        {accepted && !continuesHere(accepted.serviceJourney) && accepted.serviceJourney && (
          <HandOff journey={accepted.serviceJourney} onGo={onHandOff} />
        )}
      </div>
      <OfferDetailsDrawer
        offer={detailOffer}
        serviceLabel={journeyLabel(detailOffer?.serviceJourney) ?? '-'}
        fixedService={detailOffer?.serviceJourney === 'new-fixed-line' || detailOffer?.serviceJourney === 'new-fwa'}
        highlight={detailOffer ? offerHighlight(detailOffer, products) : null}
        includedNames={(detailOffer?.linkedProductIds ?? []).map((id) => productNames[id] ?? id)}
        selected={Boolean(detailOffer && value.decision === 'accepted' && value.offerId === detailOffer.offerId)}
        onSelect={() =>
          detailOffer &&
          onChange({
            decision: 'accepted',
            offerId: detailOffer.offerId,
            offerName: detailOffer.offerName,
            journey: detailOffer.serviceJourney,
            linkedProductIds: detailOffer.linkedProductIds,
          })
        }
        onClose={() => setDetailOffer(null)}
      />
    </div>
  );
}

/** Continue is open once the agent has decided (or nothing was offered), except
 * an accepted offer for a journey that continues elsewhere - that has its own button. */
export const isCrossSalesValid = (v: CrossSalesValue | undefined) =>
  Boolean(v?.decision) && (v?.decision !== 'accepted' || continuesHere(v.journey));

// ---------------------------------------------------------------- Standard catalogue

export function JourneyStep({
  value,
  onChange,
  onHandOff,
}: {
  value: ServiceJourney | undefined;
  onChange: (v: ServiceJourney) => void;
  onHandOff: (route: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-fg-2 text-[length:var(--fs-body)]">
        No cross-sales offer is being used, so choose the service from the standard Sales Offers catalogue.
      </p>
      <div role="radiogroup" aria-label="Service journey" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_JOURNEYS.map((j) => (
          <div
            key={j.key}
            role="radio"
            aria-checked={value === j.key}
            tabIndex={0}
            onClick={() => onChange(j.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(j.key);
              }
            }}
            className={`${CARD_SELECTABLE} cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${value === j.key ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'}`}
          >
            <span className="block text-fg font-medium text-[length:var(--fs-body)]">{j.label}</span>
            <span className="block text-fg-2 text-[length:var(--fs-caption)]">{j.description}</span>
          </div>
        ))}
      </div>
      {value && !continuesHere(value) && <HandOff journey={value} onGo={onHandOff} />}
    </div>
  );
}

// ---------------------------------------------------------------- Plan source

export function PlanSourceBanner({ offerName, customerType }: { offerName?: string; customerType?: CustomerType }) {
  const special = customerType && customerType !== 'none';
  const isSalesOffer = Boolean(offerName) || special;
  return (
    <div className={`${CARD} mb-5 flex items-center justify-between gap-3`}>
      <div>
        <p className="text-fg font-semibold text-[length:var(--fs-body)]">{isSalesOffer ? 'Sales Offers' : 'General Plan'}</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">
          {offerName
            ? `Based on the accepted cross-sales offer: ${offerName}.`
            : special
              ? `Offers for ${customerTypeLabel(customerType)} customers.`
              : 'Standard catalogue plans.'}
        </p>
      </div>
      <Badge variant={isSalesOffer ? 'success' : 'filled-neutral'}>{isSalesOffer ? 'Sales Offer' : 'General'}</Badge>
    </div>
  );
}

// ---------------------------------------------------------------- Eligibility outcomes

// Reference view of what each eligibility outcome covers: the blockers that
// produce it and the message the agent sees. The rows are the REAL checks - each
// one comes from evaluateEligibilityChecks run over a sample customer that
// trips just that check - so this cannot drift from what the engine says.
// The QR amount in the collections message is sample data.

const SAMPLE_ASOF = new Date('2026-09-30');
const baseCtx = (): EligibilityContext => ({
  customer: { customerId: 'SAMPLE', idType: 'QID', dob: '1985-03-12', blacklisted: false },
  doc: { documentType: 'QID', documentNumber: 'SAMPLE', expiryDate: '2029-11-30' },
  deals: [],
  outstandingQar: 0,
  lineCapReached: false,
  activeLinesDetail: '',
});

function rowFor(checkId: string, ctx: EligibilityContext): EligibilityRow {
  const c = evaluateEligibilityChecks(ctx, SAMPLE_ASOF).find((x) => x.id === checkId)!;
  return { id: c.id, title: c.label, detail: c.message, tone: c.outcome };
}

type OutcomeKey = 'Hard Stop' | 'Soft Stop' | 'Approval Routing' | 'Advisory Only';

function outcomeRows(key: OutcomeKey): EligibilityRow[] {
  const b = baseCtx();
  switch (key) {
    case 'Hard Stop':
      return [
        rowFor('id-validity', { ...b, doc: { ...b.doc, expiryDate: '2025-08-31' } }),
        rowFor('blacklist-security', { ...b, customer: { ...b.customer, blacklisted: true, blacklistCategory: 'security' } }),
        rowFor('deals', { ...b, deals: [{ customerId: 'SAMPLE', blocksNewConnection: true }] }),
      ];
    case 'Soft Stop':
      return [
        rowFor('blacklist-collections', {
          ...b,
          customer: { ...b.customer, blacklisted: true, blacklistCategory: 'collections' },
          outstandingQar: 350,
        }),
      ];
    case 'Approval Routing':
      return [
        rowFor('age', { ...b, customer: { ...b.customer, dob: '2012-05-01' } }),
        rowFor('id-type-routing', { ...b, doc: { ...b.doc, documentType: 'Passport' } }),
        rowFor('active-lines', {
          ...b,
          lineCapReached: true,
          activeLinesDetail: evaluateRule('BR-288', { nationality: 'Indian', activePostpaidLines: 2 }).message ?? '',
        }),
      ];
    case 'Advisory Only':
      return buildEligibilityRows([], true, undefined).filter((r) => r.id === 'hrn');
  }
}

const OUTCOME_KEYS: OutcomeKey[] = ['Hard Stop', 'Soft Stop', 'Approval Routing', 'Advisory Only'];

// The footer links and the inline panel live in different parts of the wizard
// (footer vs step body), so the selected outcome is shared through a tiny store.
const useOutcomePreview = create<{ open: OutcomeKey | null; toggle: (k: OutcomeKey) => void; close: () => void }>((set) => ({
  open: null,
  toggle: (k) => set((st) => ({ open: st.open === k ? null : k })),
  close: () => set({ open: null }),
}));

// Demo-only controls (they preview an outcome the real checks did not produce),
// so they use the violet --info colour rather than the brand red - violet marks
// "demo" content wherever it appears.
export function EligibilityOutcomeLinks() {
  const { open, toggle } = useOutcomePreview();
  return (
    <div className="demo-only flex flex-wrap items-center gap-x-3">
      {OUTCOME_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={open === k}
          onClick={() => toggle(k)}
          className={`text-[length:var(--fs-caption)] underline text-[var(--info)] hover:opacity-80 focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-button)] px-1 ${open === k ? 'font-semibold' : ''}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** Inline, in the step body: the blockers behind the outcome picked in the footer. */
export function EligibilityOutcomePanel() {
  const { open, close } = useOutcomePreview();
  // Leaving the step drops the preview.
  useEffect(() => close, [close]);
  if (!open) return null;
  return (
    <div className="space-y-2" role="region" aria-label={`${open} blockers`}>
      <div className="flex justify-end">
        <button type="button" onClick={close} className="text-[length:var(--fs-caption)] text-muted underline hover:text-accent px-1">
          Hide
        </button>
      </div>
      <EligibilityChecksList rows={outcomeRows(open)} />
    </div>
  );
}

/**
 * The step footer's primary action, by eligibility outcome. The outcome picked
 * with the footer links (a preview) wins; otherwise it is the customer's real
 * result. Advisory Only and a clean result keep the ordinary Continue.
 */
export function OutcomeActions({
  eligibility,
  defaultButton,
  onAbandon,
}: {
  eligibility: EligibilityResult | undefined;
  defaultButton: ReactNode;
  onAbandon: () => void;
}) {
  const preview = useOutcomePreview((s) => s.open);
  const [confirm, setConfirm] = useState<'payment' | 'approval' | 'prepaid' | null>(null);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const real: OutcomeKey | undefined = eligibility?.hardStop
    ? 'Hard Stop'
    : eligibility?.softStop
      ? 'Soft Stop'
      : eligibility?.checks.some((c) => c.outcome === 'approval-routing')
        ? 'Approval Routing'
        : undefined;
  const outcome = preview ?? real;

  const modal = (
    <Modal
      open={confirm !== null}
      onClose={() => setConfirm(null)}
      title={confirm === 'payment' ? 'Proceed to Payment?' : confirm === 'prepaid' ? 'Continue Prepaid?' : 'Request approval?'}
      footer={
        <>
          <Button variant="ghost-rect" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="primary-rect"
            onClick={() => {
              const which = confirm;
              setConfirm(null);
              // Approval and prepaid confirmations only close the modal.
              if (which === 'payment')
                pushToast('info', 'Payment is not available from here yet', {
                  key: 'soft-stop-payment',
                  detail: 'Settling the outstanding balance is not part of this journey yet.',
                });
            }}
          >
            {confirm === 'payment' ? 'Proceed to Payment' : confirm === 'prepaid' ? 'Continue Prepaid' : 'Request Approval'}
          </Button>
        </>
      }
    >
      <p className="text-fg-2 text-[length:var(--fs-body)]">
        {confirm === 'payment'
          ? 'Continue to payment for this customer?'
          : confirm === 'prepaid'
            ? 'This will trigger the prepaid flow.'
            : 'The journey will continue and the order will be held for manager approval before it can be completed.'}
      </p>
    </Modal>
  );

  if (outcome === 'Hard Stop')
    return (
      <Button variant="primary-rect" onClick={onAbandon}>
        Abandon Order
      </Button>
    );
  if (outcome === 'Soft Stop')
    return (
      <div className="flex items-center gap-3">
        <Button variant="secondary-rect" onClick={() => setConfirm('prepaid')}>
          Continue Prepaid
        </Button>
        <Button variant="primary-rect" onClick={() => setConfirm('payment')}>
          Proceed to Payment
        </Button>
        {modal}
      </div>
    );
  // Approval Routing: no separate button - the ordinary Continue applies, and
  // approval is requested when the order is submitted.
  return <>{defaultButton}</>;
}

/**
 * Footer for the Offers step: "Skip" (take no offer, go on to the standard
 * catalogue) before the ordinary Continue. Skip records the decline and only
 * THEN advances - from an effect, so the wizard has recomputed its steps from
 * the new values (declining re-opens the Service step that an accepted offer
 * had skipped) before it moves.
 */
export function SkipAndContinue({
  onSkip,
  goNext,
  defaultButton,
}: {
  onSkip: () => void;
  goNext: () => void;
  defaultButton: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    setPending(false);
    goNext();
  }, [pending, goNext]);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary-rect"
        onClick={() => {
          onSkip();
          setPending(true);
        }}
      >
        Skip
      </Button>
      {defaultButton}
    </div>
  );
}

/**
 * Offers-step footer (2026-10-01): Reject / Interested / Accept in place of
 * Skip / Continue.
 *  - Accept: continue with the selected offer (enabled only once a valid offer
 *    is selected).
 *  - Reject: same as the old Skip - no offer, on to the standard catalogue.
 *  - Interested: the customer wants the offer but not now - the caller creates
 *    a lead for it, confirms it in a "Lead Created" modal and takes the agent
 *    to the Leads page (the journey ends here).
 * Reject and Interested change the draft values first and move on a render
 * later (see SkipAndContinue for why goNext must wait for that re-render).
 */
/** The journeys offered when the agent skips the cross-sell offer. */
// Order: Postpaid, Prepaid, Fixed Line.
const NEXT_JOURNEYS = (['new-postpaid', 'new-prepaid', 'new-fixed-line'] as const)
  .map((k) => SERVICE_JOURNEYS.find((j) => j.key === k)!)
  .map((j) => ({
  ...j,
  label: j.key === 'new-postpaid' ? 'Postpaid' : j.key === 'new-prepaid' ? 'Prepaid' : 'Fixed Line',
}));

export function OfferDecisionActions({
  canAccept,
  canExpressInterest,
  onReject,
  onInterested,
  goNext,
  onHandOff,
}: {
  canAccept: boolean;
  canExpressInterest: boolean;
  onReject: () => void;
  onInterested: () => Promise<void>;
  goNext: () => void;
  /** Leaves for another journey's own wizard (Prepaid, Fixed Line). */
  onHandOff: (route: string) => void;
}) {
  const [pending, setPending] = useState(false);
  // Skip no longer assumes Postpaid: the agent says which journey comes next.
  const [chooseJourney, setChooseJourney] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pending) return;
    setPending(false);
    goNext();
  }, [pending, goNext]);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary-rect"
        disabled={busy}
        onClick={() => setChooseJourney(true)}
      >
        Skip
      </Button>
      <Modal
        open={chooseJourney}
        onClose={() => setChooseJourney(false)}
        title="Select the next journey"
        footer={
          <Button variant="ghost-rect" onClick={() => setChooseJourney(false)}>
            Cancel
          </Button>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)] mb-4">No offer will be taken. Which journey should this customer continue in?</p>
        <div className="grid gap-3">
          {NEXT_JOURNEYS.map((j) => (
            <button
              key={j.key}
              type="button"
              onClick={() => {
                setChooseJourney(false);
                if (continuesHere(j.key)) {
                  // Postpaid continues in this wizard: decline the offer, on to the plan step.
                  onReject();
                  setPending(true);
                } else if (j.route) {
                  onHandOff(j.route);
                }
              }}
              className={`${CARD_SELECTABLE} text-left border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)] transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)]`}
            >
              <span className="block text-fg font-medium text-[length:var(--fs-body)]">{j.label}</span>
              <span className="block text-fg-2 text-[length:var(--fs-caption)]">{j.description}</span>
            </button>
          ))}
        </div>
      </Modal>
      <Button
        variant="secondary-rect"
        disabled={!canExpressInterest || busy}
        onClick={async () => {
          setBusy(true);
          try {
            // The caller shows the "Lead Created" confirmation and then leaves for
            // the Leads page, so there is no goNext here.
            await onInterested();
          } finally {
            setBusy(false);
          }
        }}
      >
        Interested
      </Button>
      <Button variant="primary-rect" disabled={!canAccept || busy} onClick={goNext}>
        Accept
      </Button>
    </div>
  );
}
