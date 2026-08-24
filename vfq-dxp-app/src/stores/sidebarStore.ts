import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      mobileOpen: false,
      toggleMobileOpen: () => set({ mobileOpen: !get().mobileOpen }),
      closeMobile: () => set({ mobileOpen: false }),
    }),
    {
      name: 'vfq-sidebar-store',
      // Only persist the desktop collapse preference — the mobile drawer's
      // open/closed state is ephemeral per-session, not a saved preference.
      partialize: (state) => ({ collapsed: state.collapsed }),
    }
  )
);
