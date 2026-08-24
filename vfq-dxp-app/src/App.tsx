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
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PersonaSwitcher />
          <Breadcrumbs />
          <main className="flex-1 overflow-y-auto bg-surface">
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <ToastContainer />
    </BrowserRouter>
  );
}
