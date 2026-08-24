import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEntityStore } from '../../stores/entityStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Modal } from '../../components/primitives/Modal';
import { Select } from '../../components/primitives/Select';
import { Textarea } from '../../components/primitives/Textarea';
import { Input } from '../../components/primitives/Input';
import * as mockDataEngine from '../../engines/mockDataEngine';
import type { Lead } from './types';

interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}
interface Agent {
  userId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

// SCR-141 Lead Details View + its four evidenced sub-actions:
// SCR-145 Reject Lead modal, SCR-146 Lead Owner reassignment picker,
// SCR-148 Description edit popup, SCR-149 CallBack Date/Time picker.
export function LeadDetailsView() {
  const [params] = useSearchParams();
  const leadId = params.get('id');
  const leads = (useEntityStore((s) => s.records.leads) ?? []) as unknown as Lead[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modal, setModal] = useState<'reject' | 'reassign' | 'description' | 'callback' | null>(null);
  const [rejectCode, setRejectCode] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [callbackDraft, setCallbackDraft] = useState('');

  useEffect(() => {
    loadKind('leads');
    mockDataEngine.list<RejectReason>('reject-reasons').then(setReasons);
    mockDataEngine.list<Agent>('users-agents').then(setAgents);
  }, [loadKind]);

  const lead = leads.find((l) => l.leadId === leadId) ?? leads[0];

  if (!lead) {
    return <div className="p-8 text-fg-2">No lead selected — go back to a lead list and pick a row.</div>;
  }

  const filteredAgents = agents.filter((a) => a.lastName.toLowerCase().includes(ownerFilter.toLowerCase()));

  const submitReject = async () => {
    await updateRecord('leads', 'leadId', lead.leadId, {
      status: 'Rejected',
      rejectReasonCode: rejectCode,
      rejectComment,
    });
    pushToast('warning', `Lead ${lead.leadId} rejected: ${reasons.find((r) => r.reasonCode === rejectCode)?.reasonLabel ?? rejectCode}`);
    setModal(null);
  };

  const submitReassign = async (agent: Agent) => {
    await updateRecord('leads', 'leadId', lead.leadId, { ownerId: agent.userId });
    pushToast('success', `Lead ${lead.leadId} reassigned to ${agent.firstName} ${agent.lastName}`);
    setModal(null);
  };

  const submitDescription = async () => {
    await updateRecord('leads', 'leadId', lead.leadId, { description: descriptionDraft });
    pushToast('success', 'Description updated.');
    setModal(null);
  };

  const submitCallback = async () => {
    await updateRecord('leads', 'leadId', lead.leadId, { callbackDate: callbackDraft, status: 'In Progress', subStatus: 'Call Back' });
    pushToast('success', `Callback set for ${callbackDraft} — Lead Status auto-transitioned to In Progress / Call Back.`);
    setModal(null);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">Lead {lead.leadId}</h1>
        <Badge variant={lead.status === 'Rejected' ? 'danger' : 'outlined-red'}>{lead.status}</Badge>
      </div>
      <p className="text-fg-2 mb-6">{lead.serviceNeeded} — owned by {lead.ownerId}</p>

      <dl className="grid grid-cols-2 gap-4 text-[length:var(--fs-body)] mb-6">
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Sub Status</dt>
          <dd className="text-fg">{lead.subStatus ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Callback Date</dt>
          <dd className="text-fg">{lead.callbackDate ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Fixed Pre-Sales</dt>
          <dd className="text-fg">{lead.fixedPreSalesRequested ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Created Via</dt>
          <dd className="text-fg">{lead.createdVia}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[length:var(--fs-caption)] text-muted">Description</dt>
          <dd className="text-fg">{lead.description ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary-rect" onClick={() => { setDescriptionDraft(lead.description ?? ''); setModal('description'); }}>
          Edit Description
        </Button>
        <Button variant="ghost-rect" onClick={() => { setCallbackDraft(lead.callbackDate ?? ''); setModal('callback'); }}>
          Set Callback
        </Button>
        <Button variant="ghost-rect" onClick={() => setModal('reassign')}>
          Reassign Owner
        </Button>
        <Button variant="ghost-rect" className="!text-danger !border-danger" onClick={() => setModal('reject')}>
          Reject
        </Button>
      </div>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Reject Lead">
        <div className="space-y-3">
          <Select
            label="Reject Reason Code"
            value={rejectCode}
            onChange={(e) => setRejectCode(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Reject Comment" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={submitReject} disabled={!rejectCode}>Confirm rejection</Button>
        </div>
      </Modal>

      <Modal open={modal === 'reassign'} onClose={() => setModal(null)} title="Lead Owner">
        <Input placeholder="Filter by Last Name" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} />
        <div className="mt-3 divide-y divide-border-soft max-h-64 overflow-y-auto">
          {filteredAgents.map((a) => (
            <button
              key={a.userId}
              onClick={() => submitReassign(a)}
              className="w-full text-left px-2 py-2 hover:bg-surface flex justify-between"
            >
              <span className="text-fg">{a.firstName} {a.lastName}</span>
              <span className="text-muted text-[length:var(--fs-caption)]">{a.jobTitle}</span>
            </button>
          ))}
          {filteredAgents.length === 0 && <p className="text-muted py-3 text-center">No matching candidates.</p>}
        </div>
      </Modal>

      <Modal
        open={modal === 'description'}
        onClose={() => setModal(null)}
        title="Description"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary-rect" onClick={submitDescription}>Save description</Button>
          </>
        }
      >
        <Textarea value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
      </Modal>

      <Modal
        open={modal === 'callback'}
        onClose={() => setModal(null)}
        title="CallBack Date/Time"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary-rect" onClick={submitCallback} disabled={!callbackDraft}>Done</Button>
          </>
        }
      >
        <Input type="datetime-local" value={callbackDraft} onChange={(e) => setCallbackDraft(e.target.value)} />
      </Modal>
    </div>
  );
}
