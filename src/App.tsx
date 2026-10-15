import { useEffect, useMemo } from 'react';
import { createBrowserRouter, RouterProvider, useLocation } from 'react-router-dom';
import { Button } from './components/primitives/Button';
import { useConfigStore } from './stores/configStore';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { Sidebar } from './navigation/Sidebar';
import { Breadcrumbs } from './navigation/Breadcrumbs';
import { PersonaSwitcher } from './navigation/PersonaSwitcher';
import { AppRouter } from './router';
import { ToastContainer } from './capabilities';
import { LoginPage } from './auth/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MAIN_ID, useRouteAnnouncer } from './navigation/useRouteAnnouncer';

export default function App() {
  const ready = useConfigStore((s) => s.ready);
  const error = useConfigStore((s) => s.error);
  const boot = useConfigStore((s) => s.boot);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const language = useAuthStore((s) => s.profile?.language);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Agent 360 APM-09: the app's own strings aren't translated (no Arabic
  // copy exists anywhere in the source corpus - D-03 leaves language
  // completeness open), but layout mirroring is a real, honest effect of
  // an Arabic preference that doesn't require inventing translated text.
  useEffect(() => {
    const isArabic = language === 'العربية';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [language]);

  if (error) {
    return (
      <div className="p-8 space-y-3" role="alert">
        <p className="text-danger font-medium">The application could not start.</p>
        <p className="text-fg-2">Check your connection and try again.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    );
  }

  if (!ready) {
    return <div className="p-8 text-fg-2">Loading VFQ DXP…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

// The signed-in app, on a DATA router (one catch-all route; AppRouter's own <Routes> still do the routing) because that
// is what lets a guided journey stop navigation and ask what to do with its progress (useBlocker). It is created when the
// signed-in app mounts, not at page load, so it reads the URL LoginPage has already reset to "/".
function AuthenticatedApp() {
  const router = useMemo(() => createBrowserRouter([{ path: '*', element: <Shell /> }]), []);
  return <RouterProvider router={router} />;
}

function Shell() {
  const { pathname } = useLocation();
  const routeAnnouncement = useRouteAnnouncer(pathname);
  return (
    <>
      {/* First tab stop: jump past the sidebar and the top bar (WCAG 2.4.1). Visible only while focused. */}
      <a
        href={`#${MAIN_ID}`}
        className="no-print sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-[var(--radius-button)] focus:bg-bg focus:px-4 focus:py-2 focus:text-fg focus:font-semibold focus:shadow-raised"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
      >
        Skip to main content
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {routeAnnouncement}
      </p>
      <div className="flex h-screen">
        <div className="no-print contents">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="no-print contents">
            <PersonaSwitcher />
            <Breadcrumbs />
          </div>
          {/* relative: <main> is the scroll container, so it must anchor absolutely positioned descendants (e.g. the visually
              hidden file inputs). Otherwise they resolve against the viewport and land a full scroll-offset below their
              card, inflating the scrollable height. */}
          <main id={MAIN_ID} tabIndex={-1} className="relative flex-1 overflow-y-auto bg-[var(--page-bg)] focus:outline-none">
            <ErrorBoundary resetKey={pathname}>
              <AppRouter />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <div className="no-print contents">
        <ToastContainer />
      </div>
    </>
  );
}
