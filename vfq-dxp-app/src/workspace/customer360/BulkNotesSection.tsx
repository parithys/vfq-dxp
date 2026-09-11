import { useEffect } from 'react';
import { useEntityStore } from '../../stores/entityStore';

interface BulkNote {
  noteId: string;
  content: string;
  accountIds: string[];
  postedAt: string;
}

// Agent 360 BNT-01/02/03: an agent views notes pushed by the system with
// posting date/time, including notes applied to multiple accounts at once
// (BNT-02) — this view just needs to match any of the customer's own
// account IDs against a note's accountIds array. No expiry rule is applied
// (BNT-03: "display irrespective of timeline... unless business confirms
// an expiry rule" — none has been confirmed).
export function BulkNotesSection({ accountIds }: { accountIds: string[] }) {
  const notes = (useEntityStore((s) => s.records['bulk-notes']) ?? []) as unknown as BulkNote[];
  const loadKind = useEntityStore((s) => s.loadKind);

  useEffect(() => {
    loadKind('bulk-notes');
  }, [loadKind]);

  const applicable = notes
    .filter((n) => n.accountIds.some((id) => accountIds.includes(id)))
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  if (applicable.length === 0) {
    return <p className="text-muted text-[length:var(--fs-body)]">No bulk notes apply to this customer's accounts.</p>;
  }

  return (
    <div className="space-y-2">
      {applicable.map((note) => (
        <div key={note.noteId} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <p className="text-fg text-[length:var(--fs-body)]">{note.content}</p>
          <p className="text-muted text-[length:var(--fs-caption)] mt-1">
            Posted {new Date(note.postedAt).toLocaleString()} · applies to {note.accountIds.length} account
            {note.accountIds.length === 1 ? '' : 's'}
          </p>
        </div>
      ))}
    </div>
  );
}
