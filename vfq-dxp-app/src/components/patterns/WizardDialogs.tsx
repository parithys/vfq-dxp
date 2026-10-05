import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';
import { Textarea } from '../primitives/Textarea';

/**
 * Abandon confirmation. The comment is required (blank or whitespace-only blocks the button) unless the
 * step started the abandon itself (`noKeep`, e.g. a hard stop), which only dismisses the dialog.
 */
export function AbandonDialog({
  open,
  noKeep,
  comments,
  onCommentsChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  noKeep: boolean;
  comments: string;
  onCommentsChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abandon this order?"
      footer={
        <>
          {!noKeep && (
            <Button variant="ghost-rect" onClick={onClose}>
              Keep working
            </Button>
          )}
          <Button
            variant="primary-rect"
            // The step-initiated variant (hard stop) only dismisses the modal.
            onClick={() => (noKeep ? onClose() : onConfirm())}
            disabled={!noKeep && !comments.trim()}
          >
            Abandon Order
          </Button>
        </>
      }
    >
      <p className="text-fg-2 text-[length:var(--fs-body)]">
        Everything entered for this customer will be discarded and the saved draft deleted. This cannot be undone.
      </p>
      {!noKeep && (
        <div className="mt-4">
          <Textarea
            label="Comments (required)"
            rows={3}
            value={comments}
            onChange={(e) => onCommentsChange(e.target.value)}
            error={comments.length > 0 && !comments.trim() ? 'Enter a comment to abandon this order.' : undefined}
            helperText="Required. Recorded on the activity that is created automatically."
          />
        </div>
      )}
    </Modal>
  );
}

/** Save & Exit confirmation, with an optional comment recorded on the activity. */
export function SaveExitDialog({
  open,
  comments,
  onCommentsChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  comments: string;
  onCommentsChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save & Exit"
      footer={
        <>
          <Button variant="ghost-rect" onClick={onClose}>
            Keep working
          </Button>
          <Button variant="primary-rect" onClick={onConfirm}>
            Save & Exit
          </Button>
        </>
      }
    >
      <p className="text-fg-2 text-[length:var(--fs-body)]">This order is saved as a draft and can be resumed from Draft Orders.</p>
      <div className="mt-4">
        <Textarea
          label="Comments (optional)"
          rows={3}
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
          helperText="Recorded on the activity that is created automatically."
        />
      </div>
    </Modal>
  );
}
