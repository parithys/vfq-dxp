import { create } from 'zustand';
import { loadConfig } from '../engines/configEngine';
import { seedMockData } from '../engines/mockDataEngine';

interface ConfigStoreState {
  ready: boolean;
  error: string | null;
  boot: () => Promise<void>;
}

// Boot-time loader (frontend-architecture.md §10) — reads all config/*.json and
// mock-data/*.json once; screens/components read through the engine accessors,
// never these files directly.
export const useConfigStore = create<ConfigStoreState>((set) => ({
  ready: false,
  error: null,
  boot: async () => {
    try {
      await Promise.all([loadConfig(), seedMockData()]);
      set({ ready: true, error: null });
    } catch (err) {
      set({ ready: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
