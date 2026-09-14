import { create } from 'zustand';

interface QnomyQueueState {
  /** True in the window between an agent clicking Finish and clicking Next
   * Customer — the system must sit here and do nothing on its own; only an
   * explicit Next Customer click may end this state. */
  awaitingNext: boolean;
  setAwaitingNext: (value: boolean) => void;
}

// Not persisted deliberately: "awaiting next" is a live front-desk state for
// the current login session, not something that should survive a hard
// reload as if the agent were still mid-handoff after restarting the app.
export const useQnomyQueueStore = create<QnomyQueueState>((set) => ({
  awaitingNext: false,
  setAwaitingNext: (value) => set({ awaitingNext: value }),
}));
