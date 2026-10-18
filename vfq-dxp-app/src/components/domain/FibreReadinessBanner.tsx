import { useEffect, useState } from 'react';
import { Icon } from '../primitives/Icon';
import { resolveFibreServiceability } from '../../engines/fibreServiceability';
import type { FibreServiceability } from '../../engines/fibreServiceability';

interface FibreReadinessBannerProps {
  zone?: string;
  street?: string;
  building?: string;
}

const CHECK_ICON = 'M20 6L9 17l-5-5';
const CROSS_ICON = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-6 6 M9 9l6 6';
const SIGNAL_ICON = 'M5 12.5a10 10 0 0 1 14 0 M8 15.5a6 6 0 0 1 8 0 M12 19h.01';

/**
 * Read-only fibre readiness indicator for the address step, once the agent has entered a complete Zone / Street / Building. The verdict is
 * the one the rest of the app gives for that address (engines/fibreServiceability: the service-point records' RFS status) - the same answer the
 * Installation Address step and the confirmation page give, with 'unknown' when no service point matches rather than "not ready".
 *
 * PURELY INFORMATIONAL: no button, link, or click handler, and it renders only the verdict - never the address it was computed from.
 */
export function FibreReadinessBanner({ zone, street, building }: FibreReadinessBannerProps) {
  const [verdict, setVerdict] = useState<FibreServiceability | undefined>();
  const complete = Boolean(zone?.trim() && street?.trim() && building?.trim());

  useEffect(() => {
    setVerdict(undefined);
    if (!complete) return;
    let cancelled = false;
    void resolveFibreServiceability(undefined, { zone: zone!.trim(), streetNo: street!.trim(), buildingNo: building!.trim() }).then((v) => !cancelled && setVerdict(v));
    return () => {
      cancelled = true;
    };
  }, [complete, zone, street, building]);

  // Nothing to check until the agent has entered a complete ZSB (a partial address cannot be matched), and nothing to say until the check is back.
  if (!complete || verdict === undefined) return null;
  const ready = verdict === 'rfs';

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
          {verdict === 'rfs'
            ? 'Fibre infrastructure is available at this address.'
            : verdict === 'not-rfs'
              ? 'Fibre infrastructure is not currently available at this address.'
              : 'No service point matches this address, so fibre readiness is not known.'}
        </p>
      </div>
      <Icon path={ready ? CHECK_ICON : CROSS_ICON} className={`w-5 h-5 shrink-0 ${ready ? 'text-success' : 'text-muted'}`} />
    </div>
  );
}
