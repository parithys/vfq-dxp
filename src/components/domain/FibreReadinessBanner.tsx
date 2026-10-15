import { useEffect, useState } from 'react';
import { Icon } from '../primitives/Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface FibreReadinessBannerProps {
  zone?: string;
  street?: string;
  building?: string;
}

interface ZsbSiteRecord {
  zone?: string;
  street?: string;
  building?: string;
}

const CHECK_ICON = 'M20 6L9 17l-5-5';
const CROSS_ICON = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-6 6 M9 9l6 6';
const SIGNAL_ICON = 'M5 12.5a10 10 0 0 1 14 0 M8 15.5a6 6 0 0 1 8 0 M12 19h.01';

// Strips the field-name prefix ims-site-zsb.json's own zone/street/building
// carry ("Zone 55", "Street 830") down to the bare value the agent's own
// Zone/Street/Building inputs hold ("55", "830") - the two datasets format
// the same address differently, and matching has to compare like with like
// rather than treating "Zone 55" and "55" as different zones.
function bareValue(raw: string | undefined): string {
  return (raw ?? '').replace(/^[A-Za-z]+\s*/, '').trim().toLowerCase();
}

/**
 * Read-only fibre readiness indicator for the Communication Address step,
 * checked against the site's ZSB (Zone/Street/Building) infrastructure record
 * once the agent has entered all three fields.
 *
 * Grounded in ims-site-zsb.json - the only ZSB-keyed infrastructure dataset
 * in this corpus (zsbRecordId/bid/ctp/splitterPort/forecast per site).
 * "NAS" itself does not appear in the Fibre or Mobile Postpaid BRSD
 * glossaries or anywhere else in the indexed corpus (checked both), so this
 * reads the request as "the fibre-readiness check run against the ZSB
 * address" and answers that with the evidence that exists rather than
 * inventing a NAS-specific data shape or a system of that name.
 *
 * PURELY INFORMATIONAL, per direction: no button, link, or click handler
 * anywhere in this component, and it renders only the readiness verdict -
 * never the zone/street/building it was computed from, nor the matched
 * record's own bid/ctp/splitter-port/forecast detail, which would leak the
 * ZSB infrastructure data this banner exists to summarise instead of expose.
 */
export function FibreReadinessBanner({ zone, street, building }: FibreReadinessBannerProps) {
  const [sites, setSites] = useState<ZsbSiteRecord[] | null>(null);

  useEffect(() => {
    mockDataEngine.list<ZsbSiteRecord>('ims-site-zsb').then(setSites);
  }, []);

  // Nothing to check until the agent has entered a complete ZSB - a partial
  // address cannot be matched against a site record, and reporting "not
  // ready" against an empty address would read as a verdict on a real one.
  if (!zone?.trim() || !street?.trim() || !building?.trim()) return null;
  // Dataset still loading.
  if (sites === null) return null;

  const ready = sites.some(
    (s) => bareValue(s.zone) === bareValue(zone) && bareValue(s.street) === bareValue(street) && bareValue(s.building) === bareValue(building)
  );

  return (
    <div
      className={`flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 ${
        ready
          ? 'border-success bg-tone-success'
          : 'border-border-soft bg-surface'
      }`}
    >
      <Icon path={SIGNAL_ICON} className={`w-5 h-5 shrink-0 ${ready ? 'text-success' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-fg font-semibold text-[length:var(--fs-body)]">Fibre Readiness</p>
        <p className={`text-[length:var(--fs-caption)] ${ready ? 'text-success' : 'text-muted'}`}>
          {ready ? 'Fibre infrastructure is available at this address.' : 'Fibre infrastructure is not currently available at this address.'}
        </p>
      </div>
      <Icon path={ready ? CHECK_ICON : CROSS_ICON} className={`w-5 h-5 shrink-0 ${ready ? 'text-success' : 'text-muted'}`} />
    </div>
  );
}
