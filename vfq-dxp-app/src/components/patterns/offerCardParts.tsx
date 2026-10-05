// Pieces shared by the two card grids that present a plan: the Recommended-offers cards (new-connection
// steps) and the Plan & Add-ons plan cards (PostpaidPlanAddonsStep). One definition, so the two stay alike.

/** The selectable-card states, one definition for every card grid that uses them (offers, plans, numbers). */
export const CARD_SELECTED = 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]';
export const CARD_IDLE =
  'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)]';
/** A card the app singles out (the Recommended offer, a Popular plan): red border, soft pink wash. */
export const CARD_HIGHLIGHT =
  'border-[var(--field-card-selected)] bg-[linear-gradient(135deg,var(--surface-warm),var(--bg)_70%)] hover:shadow-[var(--shadow-selected-ring)]';

/**
 * The selected number-card surface (2026-10-04, from the Star-number design), defined once: a soft pink
 * gradient from the top-left, fading to the page colour, plus the two faint circles of SelectedCardTexture.
 * Use with CARD_SELECTED (border, ring) so selection is also carried by the border and the tick, never by colour alone.
 */
export const CARD_SELECTED_SURFACE = 'bg-[linear-gradient(135deg,var(--surface-warm),var(--bg)_90%)]';

/** The faint concentric circles at the bottom-right of a selected card, behind its content (the card needs `isolate`). Clipped to the card's own rounded corners. */
export function SelectedCardTexture() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <svg viewBox="0 0 120 120" className="absolute -bottom-10 -right-6 h-40 w-40">
        <circle cx="70" cy="70" r="50" fill="var(--accent)" fillOpacity="0.06" />
        <circle cx="90" cy="90" r="34" fill="var(--accent)" fillOpacity="0.06" />
      </svg>
    </span>
  );
}

export const ICON_DATA = 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2';
export const ICON_CALL = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z';
export const ICON_GIFT = 'M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z';
export const ICON_SPEED = 'M12 20a8 8 0 1 1 8-8 M12 12l4-4';
export const ICON_TV = 'M3 6h18v12H3z M8 21h8';
export const ICON_CARD = 'M3 6h18v12H3z M3 10h18 M6 15h4';
export const STAR_ICON = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z';

/** The service pill's colour for postpaid plans (the same blue the New Postpaid offer pill uses). */
export const POSTPAID_PILL = 'bg-[#e3effd] text-[#0b4a99]';

/** The plan fields a card draws its feature list from (public/mock-data/products.json). */
export interface OfferProduct {
  productId: string;
  name: string;
  dataAllowanceGB?: number | null;
  minutesAllowance?: string;
  speedTier?: string;
  speedTierMbps?: number;
  iptvIncluded?: boolean;
  benefits?: string[];
}

/** Up to four facts about a plan, read from its product record - never typed in per card. */
export function planFeatureRows(plan: OfferProduct | undefined): { icon: string; text: string }[] {
  const rows: { icon: string; text: string }[] = [];
  if (plan?.dataAllowanceGB) rows.push({ icon: ICON_DATA, text: `${plan.dataAllowanceGB} GB data` });
  if (plan?.minutesAllowance) {
    rows.push({ icon: ICON_CALL, text: /minute|call/i.test(plan.minutesAllowance) ? plan.minutesAllowance : `${plan.minutesAllowance} minutes` });
  }
  if (plan?.speedTierMbps) rows.push({ icon: ICON_SPEED, text: `${plan.speedTierMbps} Mbps fibre` });
  if (plan?.iptvIncluded) rows.push({ icon: ICON_TV, text: 'IPTV included' });
  (plan?.benefits ?? []).forEach((b) => rows.push({ icon: ICON_GIFT, text: b }));
  return rows.slice(0, 4);
}

/** Decorative card artwork: a pale disc behind a document with the brand mark. Place inside a `relative` card. */
export function OfferArtwork() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20 absolute right-4 top-14 hidden sm:block" aria-hidden="true">
      <circle cx="58" cy="60" r="48" fill="var(--surface-warm)" />
      <path d="M78 60a28 28 0 0 1-28 28" fill="none" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="14" strokeLinecap="round" />
      <rect x="32" y="24" width="46" height="64" rx="7" fill="var(--bg)" stroke="var(--border-soft)" />
      <circle cx="55" cy="56" r="12" fill="var(--accent)" />
      <circle cx="55" cy="56" r="5" fill="var(--bg)" />
      <rect x="40" y="76" width="30" height="4" rx="2" fill="var(--border-soft)" />
    </svg>
  );
}
