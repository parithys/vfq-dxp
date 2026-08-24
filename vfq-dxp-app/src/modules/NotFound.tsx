import { Link } from 'react-router-dom';
import { Button } from '../components/primitives/Button';

// Catch-all fallback for unmatched URL shapes (L3-005). Mirrors
// ScreenNotYetBuilt's minimal informational layout so an unmatched route
// renders an on-brand empty state instead of a blank content pane.
export function NotFound() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mt-3 mb-2">Page not found</h1>
      <p className="text-fg-2 mb-4">The page you're looking for doesn't exist or may have been moved.</p>
      <Link to="/">
        <Button variant="primary-rect">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
