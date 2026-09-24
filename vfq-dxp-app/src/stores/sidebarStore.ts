import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NAV_BY_KEY, type NavKey } from '../navigation/navManifest';

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
  /** Expanded nav groups (e.g. Products). A real preference, so persisted. */
  expandedNavKeys: string[];
  toggleNavGroup: (key: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      mobileOpen: false,
      toggleMobileOpen: () => set({ mobileOpen: !get().mobileOpen }),
      closeMobile: () => set({ mobileOpen: false }),
      // Both product lines open by default — their categories ARE the primary
      // way into a journey, so hiding them behind a chevron would bury the
      // main navigation path.
      expandedNavKeys: ['mobile', 'fibre-home'],
      toggleNavGroup: (key) =>
        set({
          expandedNavKeys: get().expandedNavKeys.includes(key)
            ? get().expandedNavKeys.filter((k) => k !== key)
            : [...get().expandedNavKeys, key],
        }),
    }),
    {
      name: 'vfq-sidebar-store',
      // Only persist the genuine preferences — the mobile drawer's open/closed
      // state is ephemeral per-session.
      partialize: (state) => ({
        collapsed: state.collapsed,
        expandedNavKeys: state.expandedNavKeys,
      }),
      version: 2,
      // A `version` MUST be paired with a `migrate`, even a trivial one:
      // zustand logs "State loaded from storage couldn't be migrated since no
      // migrate function was provided" on every version mismatch otherwise.
      // Removing the version instead is not an option — anyone who loaded an
      // intermediate build already has version 2 in localStorage, which would
      // then mismatch downwards and warn just the same.
      migrate: (persisted) => persisted as SidebarState,
      // Older persisted state has no expandedNavKeys; without a default the
      // Sidebar would read undefined and crash on .includes(). Applies after
      // migrate, so it normalises both paths.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SidebarState>;
        // Drop nav keys that no longer exist in the manifest (e.g. a persisted
        // 'products' from before Mobile/Fibre & Home were promoted to top
        // level). Fall back to the defaults only when the stored value is
        // unusable — absent, or written against a nav scheme where NONE of the
        // keys still exist — otherwise a returning user would get a rail with
        // every group collapsed and no hint the categories are there.
        //
        // An EMPTY stored array is deliberately respected rather than treated
        // as unusable: it means the user collapsed everything. Falling back
        // there made "all collapsed" impossible to persist — the defaults
        // reopened both groups on every reload.
        const stored = p.expandedNavKeys;
        const valid = Array.isArray(stored) ? stored.filter((k) => NAV_BY_KEY.has(k as NavKey)) : undefined;
        const usable = valid !== undefined && (valid.length > 0 || stored!.length === 0);
        return {
          ...current,
          ...p,
          expandedNavKeys: usable ? valid! : current.expandedNavKeys,
        };
      },
    }
  )
);
