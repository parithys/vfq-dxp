// Ooredoo mark, for a walk-in whose number resolves to no Vodafone record -
// i.e. a competitor's customer standing at the counter.
//
// A WORDMARK STAND-IN, NOT THE OFFICIAL LOGO. This repository has one brand
// asset (public/Vodafone_Logo.svg) and no Ooredoo artwork, and reconstructing
// a third party's trademark geometry from memory would produce something
// confidently wrong - the same reason ScannedIdPreview draws a document-shaped
// placeholder instead of inventing a Qatari ID card. What is accurate here is
// the NAME and the brand red; the letterforms are the app's own typeface.
//
// Dropping the real SVG in place of this component's body is the only change
// needed if the asset is ever added - nothing else knows what an Ooredoo mark
// looks like.
//
// The light chip is fixed rather than tokenised because its only host is the
// toast's --charcoal-panel surface, which is dark in BOTH themes: a mark that
// followed --bg would vanish into that panel in light mode.
//
// --radius-pill as of 2026-09-27, matching Badge's own corner change - see
// that file's note. This chip and Badge were the last two consumers of the
// now-removed --radius-tag.
export function OoredooMark({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Ooredoo customer"
      className={`inline-flex items-center rounded-[var(--radius-pill)] bg-white px-1.5 py-0.5 text-[length:var(--fs-micro)] font-bold leading-none tracking-tight text-[var(--brand-ooredoo)] ${className}`}
    >
      ooredoo
    </span>
  );
}
