import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Icon } from '../components/primitives/Icon';
import { Tooltip } from '../components/primitives/Tooltip';
import { TooltipGroup } from '../components/primitives/TooltipContext';
import { useSidebarStore } from '../stores/sidebarStore';
import { GlobalSearch } from './GlobalSearch';
import { SessionReferenceNumbers } from './SessionReferenceNumbers';
import { HeaderContextChips } from './HeaderContextChips';

const ICONS = {
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
  sun: 'M12 4V2 M12 22v-2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4 M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8z M9.5 17a2.5 2.5 0 0 0 5 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.2 9a2.8 2.8 0 1 1 3.9 2.6c-.9.4-1.4 1-1.4 2 M12 17h.01',
  chevronDown: 'M6 9l6 6 6-6',
  signOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
};

// Top bar: theme toggle, notifications, help, and a profile chip (with
// "Logged in as" role-switching moved into its dropdown) - replaces the
// earlier plain "Logged in as [Select] · Sign out" bar. Persona switching
// itself is unchanged (frontend-architecture.md §8's dev/demo "login-as"
// control, not a real auth boundary); it's just relocated.
export function PersonaSwitcher() {
  const staffId = useAuthStore((s) => s.staffId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const history = useNotificationStore((s) => s.history);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);
  const unreadCount = history.filter((h) => !h.read).length;

  const [open, setOpen] = useState<'notifications' | 'help' | 'profile' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggle = (panel: 'notifications' | 'help' | 'profile') => {
    setOpen((prev) => (prev === panel ? null : panel));
    if (panel === 'notifications') markAllRead();
  };

  const initials = profile ? `${profile.name.split(' ')[0][0]}${profile.name.split(' ').slice(-1)[0][0]}` : '??';

  // The in-menu role switcher was removed on 2026-09-25. Role is now set once,
  // at sign-in, from the Staff ID (LoginPage -> setActivePersona), which is
  // the path the 26 documented Staff IDs already support. Switching role
  // therefore means signing out and back in as a different ID.
  //
  // setActivePersona/pickProfileForRole are deliberately NOT removed from the
  // store and engine: LoginPage and configStore still call the former, and the
  // latter is what resolves a role's bound identity at login.

  return (
    // Bottom border is --nav-border, not --border-soft: this bar and the
    // sidebar's logo header are both h-16 with a bottom border, sitting side
    // by side, so they read as ONE horizontal rule across the shell. At
    // --border-soft (#eeeeee) against the rail's #e0e0e0 the line visibly
    // stepped where they met. Sharing the token rather than copying the value
    // keeps them joined in dark mode too, where the two resolve differently
    // (#3a3d42 vs rgba(255,255,255,.1)).
    <div className="grid grid-cols-[auto_minmax(0,28rem)_auto_minmax(0,1fr)] items-center gap-3 h-16 px-4 border-b border-[var(--nav-border)] bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] backdrop-blur">
      <button
        onClick={toggleMobileOpen}
        aria-label="Open navigation"
        className="md:hidden col-start-1 w-9 h-9 -ml-1 rounded-[var(--radius-pill)] flex items-center justify-center text-fg-2 hover:bg-surface shrink-0"
      >
        <Icon path={ICONS.menu} className="w-5 h-5" />
      </button>
      <div className="col-start-2 w-full">
        <GlobalSearch />
      </div>
      {/* One flex strip so the session reference numbers and the
          approach-driven context chips sit side by side rather than stacking. */}
      <div className="col-start-3 flex items-center gap-3">
        <SessionReferenceNumbers />
        <HeaderContextChips />
      </div>

      <TooltipGroup>
      <div ref={containerRef} className="col-start-4 justify-self-end ml-auto flex items-center gap-2">
        <Tooltip content={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} placement="bottom">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-[var(--radius-pill)] border border-border-soft flex items-center justify-center text-fg-2 hover:bg-surface"
          >
            <Icon path={theme === 'dark' ? ICONS.sun : ICONS.moon} className="w-4.5 h-4.5" />
          </button>
        </Tooltip>

        <div className="relative">
          <Tooltip content="Notifications" placement="bottom">
            <button
              onClick={() => toggle('notifications')}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-haspopup="true"
              aria-expanded={open === 'notifications'}
              className="relative w-10 h-10 rounded-[var(--radius-pill)] border border-border-soft flex items-center justify-center text-fg-2 hover:bg-surface"
            >
              <Icon path={ICONS.bell} className="w-4.5 h-4.5" />
              {unreadCount > 0 && <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
          </Tooltip>
          {open === 'notifications' && (
            <div className="absolute right-0 mt-2 w-80 rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised z-50 max-h-96 overflow-y-auto">
              <p className="px-4 py-3 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted border-b border-border-soft">Notifications</p>
              {history.length === 0 && <p className="px-4 py-6 text-fg-2 text-[length:var(--fs-body)]">No notifications yet.</p>}
              {history.map((h) => (
                <div key={h.id} className="px-4 py-3 border-b border-border-soft last:border-0">
                  {/* The reference is rendered here too, not just in the
                      toast. A keyed notification stores its number separately
                      from its headline so the toast can colour it, so a bell
                      entry that printed `message` alone would read "Assigned
                      Ticket Number:" with the number missing entirely.
                      --field-calendar-range raw, not the toast's white-lifted
                      mix: this panel is a light --bg surface, where that mix
                      would be near-invisible. */}
                  <p className="text-fg text-[length:var(--fs-body)]">
                    {h.message}
                    {h.reference && (
                      <span className="ml-1 font-semibold text-[var(--field-calendar-range)]">{h.reference}</span>
                    )}
                  </p>
                  {/* History shares the toast model, so a toast that split its
                      subject onto a detail line would otherwise lose it here. */}
                  {h.detail && <p className="text-fg-2 text-[length:var(--fs-caption)]">{h.detail}</p>}
                  <p className="text-[length:var(--fs-caption)] text-muted mt-0.5">{new Date(h.at).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Tooltip content="Help & support" placement="bottom">
            <button
              onClick={() => toggle('help')}
              aria-label="Help & support"
              aria-haspopup="true"
              aria-expanded={open === 'help'}
              className="w-10 h-10 rounded-[var(--radius-pill)] border border-border-soft flex items-center justify-center text-fg-2 hover:bg-surface"
            >
              <Icon path={ICONS.help} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
          {open === 'help' && (
            <div className="absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised z-50 p-4">
              <p className="text-fg font-medium mb-1">Help &amp; support</p>
              <p className="text-fg-2 text-[length:var(--fs-body)]">
                Contact the IT Service Desk at <span className="text-accent">servicedesk@vodafone.qa</span> or extension 4100 for platform issues.
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => toggle('profile')}
            aria-label="User profile menu"
            aria-haspopup="menu"
            aria-expanded={open === 'profile'}
            className="flex items-center gap-2 rounded-[var(--radius-pill)] pl-1.5 pr-3 py-1.5 hover:bg-surface"
          >
            <span className="w-7 h-7 rounded-full bg-accent text-white text-[length:var(--fs-caption)] font-semibold flex items-center justify-center">
              {initials}
            </span>
            <span className="text-left">
              <span className="block text-fg text-[length:var(--fs-caption)] font-medium leading-tight">{profile?.name ?? staffId}</span>
              <span className="block text-muted text-[length:var(--fs-micro)] leading-tight">{profile?.team ?? '-'}</span>
            </span>
            <Icon path={ICONS.chevronDown} className="w-3.5 h-3.5 text-muted" />
          </button>
          {open === 'profile' && (
            <div className="absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised z-50">
              <div className="px-4 py-3">
                <p className="text-fg font-medium">{profile?.name ?? staffId}</p>
                <p className="text-muted text-[length:var(--fs-caption)]">
                  {staffId} · {profile?.jobTitle ?? '-'}
                </p>
              </div>
              <Link
                to="/profile"
                onClick={() => setOpen(null)}
                className="block px-4 py-2.5 text-[length:var(--fs-body)] text-fg-2 hover:bg-surface hover:text-fg border-t border-border-soft"
              >
                Edit profile
              </Link>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-4 py-3 border-t border-border-soft text-danger hover:bg-surface text-left"
              >
                <Icon path={ICONS.signOut} className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </TooltipGroup>
    </div>
  );
}
