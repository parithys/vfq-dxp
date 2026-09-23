import { Tooltip } from '../../components/primitives/Tooltip';
import { Icon } from '../../components/primitives/Icon';
import { usePersonaStore } from '../../stores/personaStore';
import { canUseInvoiceActions } from '../../engines/agentPrivilegeEngine';
import { useNotificationStore } from '../../stores/notificationStore';
import { downloadCsv } from '../../engines/csvExport';

const DOWNLOAD_ICON = 'M12 15V3 M7 10l5 5 5-5 M4 21h16';
const RESEND_ICON = 'M4 4v6h6 M20 20v-6h-6 M20 10a8 8 0 0 0-14.9-3M4 14a8 8 0 0 0 14.9 3';
const PRINT_ICON = 'M6 9V3h12v6 M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2 M6 14h12v7H6z';

// CUS-001-BIV-28, BR-06: no real Bill Formatter / Invoice Repository
// integration exists (INT-C360-005 is a genuine Missing gap even as a mock,
// unlike the other 7 interfaces) — Download produces the one real invoice
// artifact this app can honestly generate (a CSV export of the bill's own
// fields, reusing the same csvExport engine as Profile Export); Print/Resend
// are mocked as toast-confirmed actions rather than fabricating a print
// dialog or an outbound email/SMS send. All three are gated to authorised
// agents per BR-06.
export function InvoiceActions({ bill, customerName }: { bill: Record<string, unknown>; customerName: string }) {
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const pushToast = useNotificationStore((s) => s.pushToast);
  // BR-06 now has its own capability (`invoice-actions`) instead of
  // reusing the customer-record edit gate: billing and credit-control
  // roles own invoice actions, which is narrower than "may edit a
  // customer record".
  const authorised = canUseInvoiceActions(activePersonaId);

  if (!authorised) {
    return (
      <Tooltip content="Not authorised to download/print/resend invoices (BR-06)" placement="top">
        <span className="text-muted text-[length:var(--fs-caption)] cursor-not-allowed">Restricted</span>
      </Tooltip>
    );
  }

  const download = () => {
    downloadCsv(`invoice-${bill.billId}.csv`, [{ ...bill, customerName }]);
    pushToast('success', `Invoice ${bill.billId} downloaded.`);
  };
  const resend = () => pushToast('success', `Invoice ${bill.billId} resent to ${customerName}.`);
  const print = () => pushToast('success', `Invoice ${bill.billId} sent to print.`);

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Tooltip content="Download invoice" placement="top">
        <button onClick={download} aria-label="Download invoice" className="text-muted hover:text-fg p-1">
          <Icon path={DOWNLOAD_ICON} className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Print invoice" placement="top">
        <button onClick={print} aria-label="Print invoice" className="text-muted hover:text-fg p-1">
          <Icon path={PRINT_ICON} className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content="Resend invoice" placement="top">
        <button onClick={resend} aria-label="Resend invoice" className="text-muted hover:text-fg p-1">
          <Icon path={RESEND_ICON} className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );
}
