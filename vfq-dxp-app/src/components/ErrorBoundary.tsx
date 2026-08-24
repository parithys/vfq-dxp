import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './primitives/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Class component required here: componentDidCatch/getDerivedStateFromError
// have no functional-component equivalent. Guards a single routed subtree
// (AppRouter) so a crash in one module screen doesn't white-screen the
// persistent shell (Sidebar/PersonaSwitcher/Breadcrumbs stay mounted).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 max-w-2xl mx-auto text-center flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-2">Something went wrong</h1>
          <p className="text-fg-2 mb-4">
            This screen ran into an unexpected error. You can try reloading the page.
          </p>
          <Button variant="primary-rect" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
