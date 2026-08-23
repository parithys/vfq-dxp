import { create } from 'zustand';
import * as mockDataEngine from '../engines/mockDataEngine';
import type { EntityKind } from '../engines/mockDataEngine';

interface EntityState {
  records: Partial<Record<EntityKind, Record<string, unknown>[]>>;
  loading: Partial<Record<EntityKind, boolean>>;
  loadKind: (kind: EntityKind) => Promise<void>;
  createRecord: (kind: EntityKind, record: Record<string, unknown>) => Promise<void>;
  updateRecord: (kind: EntityKind, idField: string, id: string, patch: Record<string, unknown>) => Promise<void>;
}

// The "database" — IndexedDB-backed in a full build (frontend-architecture.md §4);
// this in-memory-per-session version keeps the demo dependency-light while
// preserving the same engine boundary (components never call mockDataEngine directly).
export const useEntityStore = create<EntityState>((set, get) => ({
  records: {},
  loading: {},

  loadKind: async (kind) => {
    if (get().records[kind]) return;
    set((state) => ({ loading: { ...state.loading, [kind]: true } }));
    const data = await mockDataEngine.list(kind);
    set((state) => ({
      records: { ...state.records, [kind]: data },
      loading: { ...state.loading, [kind]: false },
    }));
  },

  createRecord: async (kind, record) => {
    const created = await mockDataEngine.create(kind, record);
    set((state) => ({
      records: { ...state.records, [kind]: [...(state.records[kind] ?? []), created] },
    }));
  },

  updateRecord: async (kind, idField, id, patch) => {
    await mockDataEngine.update(kind, id, patch);
    set((state) => ({
      records: {
        ...state.records,
        [kind]: (state.records[kind] ?? []).map((r) => (r[idField] === id ? { ...r, ...patch } : r)),
      },
    }));
  },
}));
