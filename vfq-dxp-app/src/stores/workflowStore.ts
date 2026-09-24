import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WizardDraft {
  currentStep: number;
  /** Furthest step index ever reached this session - never decreases when
   * navigating back, so a step already passed stays reachable/marked done
   * even after jumping to an earlier step to edit it. */
  maxStepReached: number;
  values: Record<string, unknown>;
}

interface WorkflowState {
  drafts: Record<string, WizardDraft>;
  getDraft: (wizardId: string) => WizardDraft;
  setStep: (wizardId: string, step: number) => void;
  setFieldValue: (wizardId: string, field: string, value: unknown) => void;
  clearDraft: (wizardId: string) => void;
}

const emptyDraft: WizardDraft = { currentStep: 0, maxStepReached: 0, values: {} };

// sessionStorage per frontend-architecture.md §4 - cleared on tab close, matching
// journeys.md's evidenced "milestone/draft-order persistence for resume" behavior
// (resumable within a session, not permanently, absent a real backend).
export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      drafts: {},
      getDraft: (wizardId) => get().drafts[wizardId] ?? emptyDraft,
      setStep: (wizardId, step) =>
        set((state) => {
          const draft = state.drafts[wizardId] ?? emptyDraft;
          return {
            drafts: {
              ...state.drafts,
              [wizardId]: { ...draft, currentStep: step, maxStepReached: Math.max(draft.maxStepReached ?? draft.currentStep, step) },
            },
          };
        }),
      setFieldValue: (wizardId, field, value) =>
        set((state) => {
          const draft = state.drafts[wizardId] ?? emptyDraft;
          return { drafts: { ...state.drafts, [wizardId]: { ...draft, values: { ...draft.values, [field]: value } } } };
        }),
      clearDraft: (wizardId) =>
        set((state) => {
          const { [wizardId]: _removed, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'vfq-workflow-store', storage: createJSONStorage(() => sessionStorage) }
  )
);
