import { useParams } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { getAllRoutes } from '../engines/configEngine';
import { Badge } from '../components/primitives/Badge';

// Honest placeholder per CLAUDE.md's evidence model — never silently invent a
// screen's behavior. Shows exactly what IS evidenced about this screen
// (blueprint/screens.md) so a future build session knows where to pick up,
// rather than a blank 404.
export function ScreenNotYetBuilt() {
  const location = useLocation();
  useParams();
  const route = getAllRoutes().find((r) => r.path === location.pathname);

  return (
    <div className="p-8 max-w-2xl">
      <Badge variant="filled-neutral">Not yet implemented</Badge>
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mt-3 mb-2">{route?.screenName ?? 'Unknown screen'}</h1>
      <p className="text-fg-2 mb-4">
        This screen is routed and evidenced in the blueprint but not yet built. Build sequencing per{' '}
        <code className="text-[length:var(--fs-caption)]">ai-coding-agent-implementation-guide.md</code> §5 prioritizes
        Fully Defined modules (Lead Management, Mobile Prepaid) first.
      </p>
      <dl className="text-[length:var(--fs-body)] text-fg-2 space-y-1">
        <div>
          <dt className="inline font-medium text-fg">Screen ID: </dt>
          <dd className="inline">{route?.screenId}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-fg">Type: </dt>
          <dd className="inline">{route?.screenType}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-fg">Module: </dt>
          <dd className="inline">{route?.module}</dd>
        </div>
      </dl>
      <p className="text-[length:var(--fs-caption)] text-muted mt-4">
        See <code>blueprint/screens.md</code> (search for {route?.screenId}) for full field/source detail.
      </p>
    </div>
  );
}
