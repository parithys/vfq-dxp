import { create } from 'zustand';
import { useCustomerContext } from './customerContextStore';
import { persist } from 'zustand/middleware';
import { resetApplicationState } from '../auth/resetSession';

export interface AgentProfile {
  userId: string;
  name: string;
  jobTitle: string;
  team: string;
  /** Agent 360 BRSD APM-08/DF-AGT-006 - MFA is off by default; method values
   * are a placeholder LOV (OI-AGN-06 leaves the real allowed set open). */
  mfaEnabled?: boolean;
  mfaMethod?: 'Authenticator App' | 'SMS OTP';
  /** APM-09/DF-AGT-008: "English and/or Arabic options are available subject
   * to VFQ confirmation" (D-03 - completeness open). Defaults to English. */
  language?: 'English' | 'العربية';
}

interface AuthState {
  isAuthenticated: boolean;
  staffId: string;
  profile: AgentProfile | null;
  signIn: (staffId: string, profile: AgentProfile) => void;
  signOut: () => void;
  /** Re-resolve the displayed identity (name/job title/team) when switching
   * role from the profile menu, without a full sign-out/sign-in - staffId is
   * unchanged since that's the logged-in user, not the active role. */
  setProfile: (profile: AgentProfile) => void;
}

// Mocked SSO gate - no real backend, so "signing in" just flips this flag.
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
      // Signing out (or a session timeout, which signs out) ends the session: every persisted
      // store is cleared and the page reloads, so the next login starts from the code's defaults
      // (see resetApplicationState).
      signOut: () => {
        useCustomerContext.getState().endJourney();
        set({ isAuthenticated: false, staffId: '', profile: null });
        resetApplicationState();
      },
      setProfile: (profile) => set({ profile }),
    }),
    {
      name: 'vfq-auth-store',
      // Bumped alongside personaStore for the 2026-09-24 persona re-key. A
      // persisted session carries a staffId whose meaning may have changed
      // (VFQ12342-VFQ12347 all map to different roles now) and a profile
      // resolved from the old 3-identity directory, so the only safe
      // migration is to require a fresh sign-in.
      version: 2,
      migrate: () => ({
        isAuthenticated: false,
        staffId: '',
        profile: null,
        signIn: () => {},
        signOut: () => {},
        setProfile: () => {},
      }),
    }
  )
);
