import { useState } from 'react';
import { Modal } from '../../../components/primitives/Modal';
import { Select } from '../../../components/primitives/Select';
import { Textarea } from '../../../components/primitives/Textarea';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';
import { evaluateRule } from '../../../engines/ruleEngine';

// Slide 15 "Type of Tickets" taxonomy (vodafone-process-overview-290626-ec-1ed338b9).
const ISSUE_TYPES = [
  'Disconnection',
  'Migration (Pre-to-Post)',
  'Plan Downgrade',
  'Language Change',
  'End Data Session',
  'Mobile Complaints',
  'Fixed/5G Complaints',
  'SOC',
  'Human Error Complaints',
];

// Slide 36's two named example templates — evidenced only for the two
// complaint categories ("200+ issue types" each); other issue types get a
// free-text template field since no canned template is evidenced for them.
const TEMPLATES: Record<string, string> = {
  'Slow Data Performance': 'Customer reports slow mobile data speeds. Confirm network coverage, run a speed test, and check for active data-throttling flags on the account.',
  'Incorrect Charges': 'Customer disputes a charge on their latest bill. Confirm the billed amount against the account’s active plan/add-ons and check for pending adjustments.',
};

const QUEUES = ['FL Agents', 'Complaints Team'];

export interface NewTicketValue {
  customerId: string;
  issueType: string;
  template: string;
  templateContent: string;
  queue: string;
  priority: string;
}

interface TicketCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: NewTicketValue) => void | Promise<void>;
  /** Pre-fills Customer ID when opened from Customer 360, where the customer
   * is already on screen — the agent shouldn't have to re-type an ID they
   * already looked up to get here. */
  initialCustomerId?: string;
}

// SCR-213: Open UI Tickets Fields (per-issue-type template) — modal where
// agents select the ticket's issue type and paste/edit the matching template
// content; Confirm/Save commits, Cancel discards (screen-behaviour-catalogue.md).
// BR-068 gates commit on Issue Type + template content both being present —
// an unsubmitted ticket never routes to a queue.
export function TicketCreationModal({ open, onClose, onSubmit, initialCustomerId = '' }: TicketCreationModalProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [issueType, setIssueType] = useState('');
  const [template, setTemplate] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [queue, setQueue] = useState('');
  const [priority, setPriority] = useState('Medium');

  const showTemplatePicker = issueType === 'Mobile Complaints' || issueType === 'Fixed/5G Complaints';
  const gate = evaluateRule('BR-068', { issueType, templateContent });
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCustomerId('');
    setIssueType('');
    setTemplate('');
    setTemplateContent('');
    setQueue('');
    setPriority('Medium');
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ customerId, issueType, template, templateContent, queue, priority });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Trouble Ticket">
      <div className="space-y-4">
        <Input
          label="Customer ID"
          placeholder="e.g. CUST-1001"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <Select
          label="Issue Type"
          value={issueType}
          onChange={(e) => {
            setIssueType(e.target.value);
            setTemplate('');
            setTemplateContent('');
          }}
          placeholder="Select an issue type"
          options={ISSUE_TYPES.map((t) => ({ value: t, label: t }))}
        />
        {showTemplatePicker && (
          <Select
            label="Template"
            value={template}
            onChange={(e) => {
              const t = e.target.value;
              setTemplate(t);
              setTemplateContent(TEMPLATES[t] ?? '');
            }}
            placeholder="Select a template"
            options={Object.keys(TEMPLATES).map((t) => ({ value: t, label: t }))}
          />
        )}
        <Textarea
          label="Template Content"
          placeholder="Paste or edit the ticket template content."
          value={templateContent}
          onChange={(e) => setTemplateContent(e.target.value)}
        />
        <Select
          label="Queue"
          value={queue}
          onChange={(e) => setQueue(e.target.value)}
          placeholder="Select a queue"
          options={QUEUES.map((q) => ({ value: q, label: q }))}
        />
        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={['Low', 'Medium', 'High'].map((p) => ({ value: p, label: p }))}
        />
        {!gate.pass && <p className="text-[length:var(--fs-caption)] text-danger">{gate.message}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost-rect" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button variant="primary-rect" onClick={submit} disabled={!gate.pass || !customerId || !queue || submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
