// Extracted from OrderApprovalQueue's original inline error box - the one
// screen in the app that already distinguished "fetch failed" from "list is
// genuinely empty". Shared here so every list screen reading
// entityStore.errors[kind] renders it the same way.
export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded border border-danger px-4 py-3 text-[length:var(--fs-body)] text-danger">
      {message}
    </div>
  );
}
