import { Link } from 'react-router-dom';
import { Badge } from '../../components/primitives/Badge';
import { Icon } from '../../components/primitives/Icon';
import type { Journey, JourneyStatus } from '../../navigation/journeyCatalogue';

const ARROW_RIGHT = 'M5 12h14 M13 5l7 7-7 7';

// Status drives the whole card treatment: badge variant, border, and whether
// the card is a link at all. All three reuse existing Badge variants and
// --warn / --success tokens - no new tokens or primitives.
const STATUS: Record<JourneyStatus, {
  label: string;
  variant: 'success' | 'warning' | 'filled-neutral';
  border: string;
  cta: string;
}> = {
  available: {
    label: 'Available',
    variant: 'success',
    border: 'border-border-soft hover:border-accent hover:shadow-raised',
    cta: 'Start now',
  },
  partly: {
    label: 'Partly available',
    variant: 'warning',
    border: 'border-[var(--warn)] hover:shadow-raised',
    cta: 'Check compatibility',
  },
  planned: {
    label: 'Planned',
    variant: 'filled-neutral',
    // Dashed = nothing to click. The border itself carries the affordance,
    // so a planned card never looks interactive.
    border: 'border-dashed border-border-soft',
    cta: 'Not yet open',
  },
};

export function JourneyCard({ journey, index, to }: { journey: Journey; index: number; to?: string }) {
  const s = STATUS[journey.status];
  const interactive = Boolean(to) && journey.status !== 'planned';

  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge variant={s.variant}>{s.label}</Badge>
        <span className="text-[length:var(--fs-caption)] text-muted tabular-nums shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div
        className={`font-medium text-[length:var(--fs-body-lg)] mb-1 ${
          journey.status === 'planned' ? 'text-fg-2' : 'text-fg'
        }`}
      >
        {journey.title}
      </div>
      <p className="text-fg-2 text-[length:var(--fs-body)] mb-3">{journey.description}</p>
      {interactive ? (
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-[length:var(--fs-body)] ${
            journey.status === 'available' ? 'text-accent' : 'text-[var(--warn-text)]'
          }`}
        >
          {s.cta}
          {journey.status === 'available' && <Icon path={ARROW_RIGHT} className="w-4 h-4" />}
        </span>
      ) : (
        <span className="text-muted text-[length:var(--fs-body)]">{s.cta}</span>
      )}
    </>
  );

  const shell = `rounded-[var(--radius-card)] border bg-bg p-5 transition-all ${s.border}`;

  if (!interactive) return <div className={shell}>{body}</div>;
  return (
    <Link to={to!} className={`group block ${shell}`}>
      {body}
    </Link>
  );
}
