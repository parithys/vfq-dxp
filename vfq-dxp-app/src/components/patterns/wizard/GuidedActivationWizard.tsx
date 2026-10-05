import { useLocation } from 'react-router-dom';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { AbandonDialog, SaveExitDialog } from './WizardDialogs';
import { CustomerMirrorPanel } from './CustomerMirrorPanel';
import { WizardRail } from './WizardRail';
import { WizardTitleBand } from './WizardTitleBand';
import { WizardStepHeader } from './WizardStepHeader';
import { WizardFooter } from './WizardFooter';
import { useEnterToSubmit } from '../../../hooks/useEnterToSubmit';
import { useJourneyStartResume } from './useJourneyStartResume';
import { useDraftStepSync } from './useDraftStepSync';
import { useCustomerViewShare } from './useCustomerViewShare';
import { useMirrorChannel } from './useMirrorChannel';
import { useStepFocus } from './useStepFocus';
import { useWizardStepNavigation } from './useWizardStepNavigation';
import { useWizardDraftActions } from './useWizardDraftActions';
import { deriveWizardNav } from './wizardNavigation';
import type { GuidedActivationWizardProps } from './guidedWizardTypes';

// Pattern 1: Guided Multi-Step Wizard - the single most-repeated shape in the
// entire corpus (SCR-043–050, SCR-121–134, SCR-152–162, SCR-190–192, etc.).
// Left-hand step list (numbered, with a secondary description line) + a
// single content panel for the active step's fields and Back/Continue
// footer - matches the reference layout supplied for this pattern.
export function GuidedActivationWizard({
  wizardId,
  title,
  titleAside,
  belowPanel,
  allowCustomerView,
  draftActionLabel,
  steps,
  onSubmit,
  onAbandon,
  hideAbandonFrom,
  onSaveExit,
}: GuidedActivationWizardProps) {
  const draft = useWorkflowStore((s) => s.getDraft(wizardId));
  const setFieldValue = useWorkflowStore((s) => s.setFieldValue);
  const location = useLocation();

  useJourneyStartResume(wizardId, steps);

  // The customer's pop-up (?mirror=1) - see useCustomerViewShare.
  const isMirror = Boolean(allowCustomerView && new URLSearchParams(location.search).get('mirror') === '1');
  const draftOrderId = draft.draftOrderId;
  useDraftStepSync(isMirror, draftOrderId, draft, steps);

  const { activeSteps, currentIndex, maxReached, currentStep, canProceed, isCustomerFacing, isLocked, abandonHidden } =
    deriveWizardNav(steps, draft, hideAbandonFrom);

  const { popupBlocked, viewOpen, shareAnnouncement, toggleCustomerView } = useCustomerViewShare(currentStep?.key);
  const mirrorCh = useMirrorChannel(allowCustomerView, isMirror, wizardId);
  const { stepHeadingRef, stepPanelRef } = useStepFocus(currentIndex);

  const setValue = (field: string, value: unknown) => setFieldValue(wizardId, field, value);

  const { submitting, goNext, goBack, goToStep, goToStepKey } = useWizardStepNavigation({
    wizardId,
    onSubmit,
    isMirror,
    activeSteps,
    currentIndex,
    maxReached,
    values: draft.values,
  });

  const {
    setAbandonOpen,
    abandonOpen,
    exitOpen,
    setExitOpen,
    activityComments,
    setActivityComments,
    abandonNoKeep,
    setAbandonNoKeep,
    abandonOrder,
    saveAndExit,
    saveDraft,
    requestAbandon,
  } = useWizardDraftActions({
    wizardId,
    title,
    draftActionLabel,
    isMirror,
    draftOrderId,
    values: draft.values,
    activeSteps,
    currentIndex,
    onAbandon,
    onSaveExit,
  });

  const handleStepKeyDown = useEnterToSubmit(canProceed && !submitting, goNext);

  // The abandon confirmation, shared by the normal layout and the customer-facing one.
  const abandonModal = (
    <AbandonDialog
      open={abandonOpen}
      noKeep={abandonNoKeep}
      comments={activityComments}
      onCommentsChange={setActivityComments}
      onClose={() => setAbandonOpen(false)}
      onConfirm={() => void abandonOrder()}
    />
  );

  // Save & Exit: confirms with an optional comment, then saves the draft and records the activity.
  const exitModal = (
    <SaveExitDialog
      open={exitOpen}
      comments={activityComments}
      onCommentsChange={setActivityComments}
      onClose={() => setExitOpen(false)}
      onConfirm={() => {
        setExitOpen(false);
        void saveAndExit(activityComments).then(() => setActivityComments(''));
      }}
    />
  );

  // Customer-facing: ONLY this step's own render() output, full stop. No
  // rail (which names every other step and product discussed), no Abandon/
  // Save & Exit, no wizard Back/Continue footer - the step's own content is
  // responsible for whatever action it needs (e.g. CafSignatureCapture's own
  // "Please Sign"), because nothing here should invite the customer to
  // interact with wizard chrome meant for the agent.
  if (isMirror) {
    // The customer's pop-up. Scrollable everywhere. Read-only on every step except CAF & Signature,
    // where the customer reads the terms, ticks the agreement and signs: those edits are sent to the
    // agent's window, which owns the order.
    const interactive = currentStep?.key === 'caf';
    const mirrorSetValue = (field: string, value: unknown) => {
      setFieldValue(wizardId, field, value);
      mirrorCh.current?.postMessage({ type: 'set', field, value });
    };
    return (
      <div className="p-8">
        <CustomerMirrorPanel step={currentStep} values={draft.values} interactive={interactive} onSetValue={mirrorSetValue} />
      </div>
    );
  }
  if (isCustomerFacing) {
    return (
      <div className="max-w-2xl mx-auto p-8" onKeyDown={handleStepKeyDown}>
        {currentStep?.render({ values: draft.values, setValue, goNext: () => void goNext(), goToStepKey, saveDraft, saveAndExit, requestAbandon })}
        {abandonModal}
      </div>
    );
  }


  return (
    <div className="flex-1 min-h-full flex flex-col">
      <WizardTitleBand
        title={title}
        titleAside={titleAside}
        popupBlocked={popupBlocked}
        onSaveExit={onSaveExit}
        onAbandon={onAbandon}
        abandonHidden={abandonHidden}
        onRequestSaveExit={() => {
          setActivityComments('');
          setExitOpen(true);
        }}
        onRequestAbandon={() => {
          setAbandonNoKeep(false);
          setAbandonOpen(true);
        }}
      />

      <span className="sr-only" aria-live="polite" role="status">
        {shareAnnouncement}
      </span>
      <span className="sr-only" aria-live="polite">
        {currentStep && `Step ${currentIndex + 1} of ${activeSteps.length}: ${currentStep.label}`}
      </span>

      <div className="flex-1 flex items-stretch">
        {!currentStep?.hideRail && (
          <WizardRail steps={activeSteps} currentIndex={currentIndex} maxReached={maxReached} isLocked={isLocked} onGoToStep={goToStep} />
        )}

        <div className="flex-1 min-w-0">
        <div
          ref={stepPanelRef}
          className={`m-8 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-6 ${viewOpen ? 'outline outline-2 outline-accent' : ''}`}
          onKeyDown={handleStepKeyDown}
        >
          <WizardStepHeader
            currentStep={currentStep}
            allowCustomerView={allowCustomerView}
            viewOpen={viewOpen}
            toggleCustomerView={toggleCustomerView}
            stepHeadingRef={stepHeadingRef}
          />
          {currentStep?.render({ values: draft.values, setValue, goNext: () => void goNext(), goToStepKey, saveDraft, saveAndExit, requestAbandon })}
          <WizardFooter
            currentStep={currentStep}
            currentIndex={currentIndex}
            stepCount={activeSteps.length}
            values={draft.values}
            isLocked={isLocked}
            canProceed={canProceed}
            submitting={submitting}
            goBack={goBack}
            goNext={goNext}
            setValue={setValue}
            onAbandonStep={(opts) => {
              setAbandonNoKeep(Boolean(opts?.hideKeepWorking));
              setAbandonOpen(true);
            }}
          />
        </div>
        {belowPanel && <div className="px-8 pb-8">{belowPanel}</div>}
        </div>
      </div>

      {/* Confirmed, not immediate: this discards every field the agent has
          entered and, once a draft order exists, deletes that row. Modal
          rather than Drawer per Modal.tsx's own note - it is reserved for
          exactly this short confirmation. */}
      {abandonModal}
      {exitModal}
    </div>
  );
}
