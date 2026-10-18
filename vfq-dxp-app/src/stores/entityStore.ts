import { create } from 'zustand';
import * as mockDataEngine from '../engines/mockDataEngine';
import type { EntityKind } from '../engines/mockDataEngine';

interface EntityState {
  records: Partial<Record<EntityKind, Record<string, unknown>[]>>;
  loading: Partial<Record<EntityKind, boolean>>;
  errors: Partial<Record<EntityKind, string>>;
  loadKind: (kind: EntityKind) => Promise<void>;
  createRecord: (kind: EntityKind, record: Record<string, unknown>) => Promise<void>;
  updateRecord: (kind: EntityKind, idField: string, id: string, patch: Record<string, unknown>) => Promise<void>;
}

// The "database" - IndexedDB-backed in a full build (frontend-architecture.md §4);
// this in-memory-per-session version keeps the demo dependency-light while
// preserving the same engine boundary (components never call mockDataEngine directly).
/** True until a kind has been loaded (never loaded, or loading now) - what a detail screen needs to tell "loading" from "not found". */
export const useKindPending = (kind: EntityKind) => useEntityStore((s) => Boolean(s.loading[kind]) || (s.records[kind] === undefined && !s.errors[kind]));

export const useEntityStore = create<EntityState>((set, get) => ({
  records: {},
  loading: {},
  errors: {},

  loadKind: async (kind) => {
    if (get().records[kind]) return;
    set((state) => ({ loading: { ...state.loading, [kind]: true } }));
    try {
      const data = await mockDataEngine.list(kind);
      set((state) => ({
        records: { ...state.records, [kind]: data },
        loading: { ...state.loading, [kind]: false },
        errors: { ...state.errors, [kind]: undefined },
      }));
    } catch (err) {
      console.error(`[entityStore] loadKind(${kind}) failed:`, err);
      set((state) => ({
        loading: { ...state.loading, [kind]: false },
        errors: { ...state.errors, [kind]: 'We could not load this list just now. Please try again.' },
      }));
    }
  },

  createRecord: async (kind, record) => {
    const created = await mockDataEngine.create(kind, record);
    // Only extend a list that has been loaded. Creating into an unloaded kind must not cache just [created] (loadKind
    // would then skip the seed rows); the next loadKind reads the engine, which already holds the new record.
    set((state) => (state.records[kind] ? { records: { ...state.records, [kind]: [...(state.records[kind] ?? []), created] } } : state));
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
