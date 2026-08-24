import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentProfile {
  userId: string;
  name: string;
  jobTitle: string;
  team: string;
}

interface AuthState {
  isAuthenticated: boolean;
  staffId: string;
  profile: AgentProfile | null;
  signIn: (staffId: string, profile: AgentProfile) => void;
  signOut: () => void;
}

// Mocked SSO gate — no real backend, so "signing in" just flips this flag.
// Persisted like personaStore so a page refresh doesn't force re-login.
// `profile` is resolved from users-agents.json at sign-in time (see
// LoginPage's pickProfileForRole) rather than typed in, matching how the
// rest of the app treats identity as already-known-by-the-system once
// authenticated (QID/MOI lookups work the same way).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      staffId: '',
      profile: null,
      signIn: (staffId, profile) => set({ isAuthenticated: true, staffId, profile }),
      signOut: () => set({ isAuthenticated: false, staffId: '', profile: null }),
    }),
    { name: 'vfq-auth-store' }
  )
);
