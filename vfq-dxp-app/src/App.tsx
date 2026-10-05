import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useConfigStore } from './stores/configStore';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { Sidebar } from './navigation/Sidebar';
import { Breadcrumbs } from './navigation/Breadcrumbs';
import { PersonaSwitcher } from './navigation/PersonaSwitcher';
import { AppRouter } from './router';
import { ToastContainer } from './components/primitives/Toast';
import { LoginPage } from './auth/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

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
      <div className="p-8 text-danger">
        Failed to load configuration/mock data: {error}
      </div>
    );
  }

  if (!ready) {
    return <div className="p-8 text-fg-2">Loading VFQ DXP…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <div className="no-print contents">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="no-print contents">
            <PersonaSwitcher />
            <Breadcrumbs />
          </div>
          <main className="flex-1 overflow-y-auto bg-[var(--page-bg)]">
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <div className="no-print contents">
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}
