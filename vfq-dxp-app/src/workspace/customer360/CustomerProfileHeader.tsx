import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, type BadgeVariant } from '../../components/primitives/Badge';
import { Icon } from '../../components/primitives/Icon';

const PHONE_ICON = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z';
const MAIL_ICON = 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6';
const CALENDAR_ICON = 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18';
const PERSON_ICON = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const GLOBE_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20';
const CIRCLE_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z';
const EYE_ICON = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EYE_OFF_ICON = 'M3 3l18 18 M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.9 M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.4-1';

export interface HeaderAlert {
  label: string;
  tone: 'danger' | 'warning';
}

export interface CustomerProfileHeaderProps {
  name: string;
  qid: string;
  idType: string;
  /** Tags beside the name (VIP, Postpaid ...). */
  tags?: { label: string; variant: BadgeVariant }[];
  blacklisted: boolean;
  dob?: string;
  gender?: string;
  preferredLanguage?: string;
  /** Primary MSISDN. */
  phone?: string;
  email?: string;
  segment: string;
  totalConnections?: number;
  creditLimit?: string;
  alerts: HeaderAlert[];
  /** Opens the alerts view; the link is omitted when not given. */
  onViewAlerts?: () => void;
  /** Header actions (Edit profile) - only for layouts that have no other way to edit the profile. */
  actions?: ReactNode;
  accountNumber?: string;
  /** Mask the ID number until revealed; `onRequestReveal` decides whether the agent may (verification gate). */
  maskId?: boolean;
  onRequestReveal?: (reveal: () => void) => void;
  /** Keep a slim identity bar pinned to the top once this header has scrolled out of view. */
  pinIdentity?: boolean;
}

const maskedId = (id: string) => (id.length > 3 ? `${'•'.repeat(id.length - 3)}${id.slice(-3)}` : id);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('')
    .toUpperCase();

function formatDob(dob?: string) {
  if (!dob) return undefined;
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? dob : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One identity fact: icon, value over a caption. Facts sit in a row separated by thin vertical rules. */
function Fact({ icon, value, caption }: { icon: string; value: string; caption: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0 px-3 first:pl-0 border-l border-border-soft first:border-l-0">
      <Icon path={icon} className="w-5 h-5 text-fg-2 shrink-0" />
      <div className="min-w-0">
        <div className="text-fg font-medium text-[length:var(--fs-body)] break-words">{value}</div>
        <div className="text-muted text-[length:var(--fs-caption)]">{caption}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 border-b border-border-soft last:border-0">
      <div className="text-[length:var(--fs-micro)] uppercase tracking-wide text-muted font-semibold whitespace-nowrap">{label}</div>
      <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value}</div>
    </div>
  );
}

/**
 * The Customer 360 profile header: identity on the left (avatar, name and tags, ID with whitelist status, then
 * date of birth / gender / preferred language / primary MSISDN / email), key figures in the middle (segment,
 * total connections, credit limit) and an Alerts & Attention card on the right. Shared by every persona; every
 * value is omitted when absent.
 */
export function CustomerProfileHeader(p: CustomerProfileHeaderProps) {
  const dob = formatDob(p.dob);
  const [revealed, setRevealed] = useState(false);
  const idShown = p.maskId && !revealed ? maskedId(p.qid) : p.qid;
  const idLabel = p.idType === 'QID' ? 'QID' : p.idType;
  // Re-mask whenever the customer changes.
  useEffect(() => setRevealed(false), [p.qid]);
  // Pinned identity bar: appears only once the full header has scrolled out of view.
  const sectionRef = useRef<HTMLElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!p.pinIdentity || !sectionRef.current) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [p.pinIdentity]);
  const revealButton = p.maskId && (
    <button
      type="button"
      onClick={() => (revealed ? setRevealed(false) : p.onRequestReveal ? p.onRequestReveal(() => setRevealed(true)) : setRevealed(true))}
      aria-label={revealed ? `Hide ${idLabel} number` : `Show ${idLabel} number`}
      aria-pressed={revealed}
      className="inline-flex items-center gap-1 rounded-[var(--radius-button)] px-1 text-accent text-[length:var(--fs-caption)] font-medium hover:underline focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
    >
      <Icon path={revealed ? EYE_OFF_ICON : EYE_ICON} className="w-4 h-4" />
      {revealed ? 'Hide' : 'Show'}
    </button>
  );
  return (
    <>
    {p.pinIdentity && (
      <div className="sticky top-0 z-20 h-0" aria-hidden={!offscreen}>
        {offscreen && (
          <div className="absolute inset-x-0 -mx-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-[var(--field-card-border)] bg-bg px-8 py-2 shadow-raised text-[length:var(--fs-body)]">
            <span className="font-bold text-fg">{p.name}</span>
            <span className="text-fg-2">
              {idLabel}: <span className="text-fg font-medium">{idShown}</span>
            </span>
            {p.accountNumber && (
              <span className="text-fg-2">
                Account: <span className="text-fg font-medium">{p.accountNumber}</span>
              </span>
            )}
            {p.phone && <span className="text-fg-2">{p.phone}</span>}
          </div>
        )}
      </div>
    )}
    <section ref={sectionRef} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 mb-4">
      <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-6">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="w-16 h-16 rounded-full bg-accent text-accent-on flex items-center justify-center text-[length:var(--fs-h4)] font-bold shrink-0" aria-hidden>
            {initials(p.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[length:var(--fs-h4)] font-bold text-fg break-words min-w-0">{p.name}</h1>
              {p.tags?.map((t) => (
                <Badge key={t.label} variant={t.variant}>
                  {t.label}
                </Badge>
              ))}
              {p.actions && <div className="ml-auto flex items-center gap-2">{p.actions}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-fg text-[length:var(--fs-body)]">
              <span>
                {idLabel}: <span className="font-medium">{idShown}</span>
              </span>
              {revealButton}
              <Badge variant={p.blacklisted ? 'danger' : 'tag-green'}>{p.blacklisted ? 'Blacklisted' : 'Whitelisted'}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-y-3 pt-2">
              {p.phone && <Fact icon={PHONE_ICON} value={p.phone} caption="Primary MSISDN" />}
              {dob && <Fact icon={CALENDAR_ICON} value={dob} caption="Date of Birth" />}
              {p.email && <Fact icon={MAIL_ICON} value={p.email} caption="Email" />}
              {p.preferredLanguage && <Fact icon={GLOBE_ICON} value={p.preferredLanguage} caption="Preferred Language" />}
              {p.gender && <Fact icon={PERSON_ICON} value={p.gender} caption="Gender" />}
            </div>
          </div>
        </div>

        <div className="lg:border-l lg:border-border-soft lg:pl-6 lg:w-52 min-w-40 shrink-0 flex flex-col justify-center">
          <Stat label="Segment" value={p.segment} />
          {p.totalConnections !== undefined && <Stat label="Total connections" value={p.totalConnections} />}
          {p.creditLimit && <Stat label="Credit limit" value={p.creditLimit} />}
        </div>

        <aside
          aria-label="Alerts and attention"
          className="rounded-[var(--radius-card)] border border-[var(--danger-border)] bg-[color-mix(in_oklab,var(--danger),var(--bg)_95%)] p-4 w-full lg:w-56 shrink-0 self-start"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-2 font-semibold text-fg text-[length:var(--fs-body)]">
              <Icon path={CIRCLE_ICON} className="w-4 h-4 text-danger" />
              Alerts &amp; Attention
            </span>
            {p.alerts.length > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-danger text-white text-[length:var(--fs-micro)] font-semibold">
                {p.alerts.length}
              </span>
            )}
          </div>
          {p.alerts.length === 0 ? (
            <p className="text-fg-2 text-[length:var(--fs-body)]">No alerts.</p>
          ) : (
            <ul className="space-y-2">
              {p.alerts.map((a) => (
                <li key={a.label} className="flex items-center gap-2 text-fg text-[length:var(--fs-body)]">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.tone === 'danger' ? 'bg-danger' : 'bg-[var(--warn)]'}`} />
                  {a.label}
                </li>
              ))}
            </ul>
          )}
          {p.onViewAlerts && (
            <button type="button" onClick={p.onViewAlerts} className="mt-3 text-accent font-medium text-[length:var(--fs-body)] hover:underline">
              View all alerts &rarr;
            </button>
          )}
        </aside>
      </div>
    </section>
    </>
  );
}
