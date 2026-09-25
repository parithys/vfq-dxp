import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '../../../components/primitives/Badge';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

function LevelBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[length:var(--fs-micro)] uppercase tracking-wide font-semibold text-muted shrink-0">
      {children}
    </span>
  );
}

// CUS-001-CAM-03/CAM-04-B: renders the actual 3-tier Customer Account ->
// Billing Account -> Service Account structure (not just a flat account
// list) with click-to-drill-down navigation between levels. Billing Account
// nodes link out to the dedicated Billing Account page (BAM-01); Service
// Account nodes expand inline to show CAM-20's distinct service-account
// detail plus CAM-05/06/07 barring status, so the tier a field belongs to is
// never ambiguous.
export function AccountHierarchySection({ data }: { data: Customer360Data }) {
  const location = useLocation();
  const [expandedBillingId, setExpandedBillingId] = useState<string | null>(
    data.billingProfiles[0] ? String(data.billingProfiles[0].billingProfileId) : null
  );
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const billingProfileIds = Array.from(new Set(data.accounts.map((a) => a.billingProfileId).filter(Boolean)));

  return (
    <div className="space-y-3">
      <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-1">
        Account Hierarchy
      </h3>

      {/* Level 1 - Customer Account */}
      <div className="rounded-[var(--radius-card)] border border-accent bg-surface-warm p-4">
        <div className="flex items-center gap-3">
          <LevelBadge>Customer Account</LevelBadge>
          <span className="font-medium text-fg">{data.customer.name}</span>
          <Badge variant="filled-neutral">{data.customer.customerId}</Badge>
        </div>
      </div>

      {/* Level 2 - Billing Account(s) */}
      <div className="pl-6 space-y-2 border-l-2 border-border-soft ml-4">
        {billingProfileIds.length === 0 && (
          <p className="text-muted text-[length:var(--fs-body)] py-2">No billing accounts on file.</p>
        )}
        {billingProfileIds.map((billingProfileId) => {
          const profile = data.billingProfiles.find((bp) => bp.billingProfileId === billingProfileId);
          const serviceAccounts = data.accounts.filter((a) => a.billingProfileId === billingProfileId);
          const isOpen = expandedBillingId === billingProfileId;
          return (
            <div key={String(billingProfileId)} className="rounded-[var(--radius-card)] border border-border-soft bg-bg">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface"
                onClick={() => setExpandedBillingId(isOpen ? null : String(billingProfileId))}
              >
                <Icon path={isOpen ? CHEVRON_DOWN : CHEVRON_RIGHT} className="w-4 h-4 text-muted shrink-0" />
                <LevelBadge>Billing Account</LevelBadge>
                <span className="font-medium text-fg">{String(profile?.name ?? billingProfileId)}</span>
                <Badge variant="filled-neutral">{String(billingProfileId)}</Badge>
                <span className="ml-auto">
                  <Link
                    to={`/billing-account/${billingProfileId}`}
                    // Forwards whatever origin brought the agent to this
                    // record, so the rail keeps showing the same destination
                    // one level deeper instead of falling back to Customer
                    // Search halfway through a queue-driven interaction.
                    state={location.state}
                    onClick={(e) => e.stopPropagation()}
                    className="text-accent text-[length:var(--fs-caption)] font-medium hover:underline"
                  >
                    View Billing Account →
                  </Link>
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pl-10 space-y-2 border-t border-border-soft pt-3">
                  {serviceAccounts.length === 0 && (
                    <p className="text-muted text-[length:var(--fs-body)]">No service accounts under this billing account.</p>
                  )}
                  {serviceAccounts.map((account) => {
                    const svcOpen = expandedServiceId === account.accountId;
                    const acct = account as unknown as Record<string, unknown>;
                    return (
                      <div key={account.accountId} className="rounded-[var(--radius-card)] border border-border-soft bg-surface">
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-warm"
                          onClick={() => setExpandedServiceId(svcOpen ? null : account.accountId)}
                        >
                          <Icon path={svcOpen ? CHEVRON_DOWN : CHEVRON_RIGHT} className="w-3.5 h-3.5 text-muted shrink-0" />
                          <LevelBadge>Service Account</LevelBadge>
                          <span className="text-fg text-[length:var(--fs-body)]">{account.accountType}</span>
                          <Badge variant={account.status === 'Active' ? 'success' : 'filled-neutral'}>{account.status}</Badge>
                          {String(acct.barringStatus ?? 'Not Barred') !== 'Not Barred' && (
                            <Badge variant="warning">{String(acct.barringStatus)}</Badge>
                          )}
                        </button>
                        {svcOpen && (
                          <div className="px-3 pb-3 pl-8 grid grid-cols-2 gap-3 text-[length:var(--fs-body)]">
                            <div>
                              <div className="text-[length:var(--fs-caption)] text-muted">Account ID</div>
                              <div className="text-fg">{account.accountId}</div>
                            </div>
                            <div>
                              <div className="text-[length:var(--fs-caption)] text-muted">Barring Type</div>
                              <div className="text-fg">{String(acct.barringType ?? '-')}</div>
                            </div>
                            <div>
                              <div className="text-[length:var(--fs-caption)] text-muted">Barring Reason</div>
                              <div className="text-fg">{String(acct.barringReason ?? '-')}</div>
                            </div>
                            {account.parentAccountId && (
                              <div>
                                <div className="text-[length:var(--fs-caption)] text-muted">Reports To</div>
                                <div className="text-fg">{account.parentAccountId}</div>
                              </div>
                            )}
                            {account.subAccountIds && account.subAccountIds.length > 0 && (
                              <div>
                                <div className="text-[length:var(--fs-caption)] text-muted">Sub-Accounts</div>
                                <div className="text-fg">{account.subAccountIds.join(', ')}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
