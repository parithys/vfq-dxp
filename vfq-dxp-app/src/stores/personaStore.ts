import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PersonaState {
  activePersonaId: string;
  setActivePersona: (id: string) => void;
}

// Default persona = PERSONA-001 (Retail/Sales Agent), the most RBAC-evidenced
// persona (20 entries in rbac-matrix.md) — the most usable starting demo view.
export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      activePersonaId: 'PERSONA-001',
      setActivePersona: (id) => set({ activePersonaId: id }),
    }),
    { name: 'vfq-persona-store' }
  )
);
