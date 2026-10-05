import { useEffect, useState, type ReactNode } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { SYNTHETIC_CLASS } from '../../data/synthetic/syntheticMarker';
import type { TncSection } from './cafTermsModel';

/**
 * The complete Terms & Conditions, in their own bordered, scrollable panel directly above the
 * signature block, so the customer can read all of it before signing and it stays in view while
 * they sign. A fixed-height panel keeps the page usable however long the terms are: the panel
 * scrolls, the page does not grow.
 */
export function FullTerms({ termsUrl, enabled, signed, children }: { termsUrl?: string; enabled: boolean; signed?: boolean; children: ReactNode }) {
  const [sections, setSections] = useState<TncSection[] | undefined>();
  useEffect(() => {
    mockDataEngine.list<TncSection>('tnc-full-text').then(setSections);
  }, []);
  // Without the terms (not the customer-facing page, or none loaded) the form stands alone.
  if (!enabled || !sections || sections.length === 0) return <>{children}</>;
  // Once signed there is nothing left to read: show just the signed form (applicant, signed
  // badge and signature) not the whole scrolling document or its link.
  if (signed) {
    return (
      <section aria-label="Signed application form" className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg">
        <div className="px-4 py-3">{children}</div>
      </section>
    );
  }
  return (
    <section aria-label="Full Terms and Conditions" className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
        <h3 className="text-fg font-semibold text-[length:var(--fs-body)]">Terms &amp; Conditions</h3>
        <span className={`${SYNTHETIC_CLASS} text-[length:var(--fs-micro)] uppercase tracking-wide`}>Sample text - replace with approved wording</span>
      </div>
      {/* tabIndex so the panel can be scrolled with the keyboard. */}
      <div tabIndex={0} className="max-h-[34rem] overflow-y-auto px-4 py-3 space-y-4 focus:outline-none focus-visible:shadow-[var(--focus-ring)]">
        {sections.map((s) => (
          <div key={s.sectionId}>
            <h4 className="text-fg font-medium text-[length:var(--fs-body)]">{s.title}</h4>
            <p className="text-fg-2 text-[length:var(--fs-caption)] leading-relaxed mt-1">{s.body}</p>
          </div>
        ))}
        {/* The application form (agreement checkbox and signature) is the LAST thing in the
            scroll area, so the customer has to scroll through every section to reach it. */}
        <div className="border-t border-border-soft mt-2 pt-2">{children}</div>
      </div>
      {termsUrl && (
        <div className="border-t border-border-soft px-4 py-2">
          <a href={termsUrl} target="_blank" rel="noreferrer" className="text-link underline text-[length:var(--fs-caption)]">
            Open the full Terms &amp; Conditions on vodafone.qa
          </a>
        </div>
      )}
    </section>
  );
}
