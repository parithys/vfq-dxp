import { useLocation } from 'react-router-dom';
import { getAllRoutes } from '../engines/configEngine';
import { getScreenComponent } from './screenRegistry';
import { ScreenNotYetBuilt } from './ScreenNotYetBuilt';

// router.tsx generated from config/routes.json (213 entries) — ScreenComponent
// resolved via the screenId -> component registry per folder-structure.md's
// "Route generation" note, falling back to ScreenNotYetBuilt.
export function ScreenRouteResolver() {
  const location = useLocation();
  const route = getAllRoutes().find((r) => r.path === location.pathname);
  const Component = route ? getScreenComponent(route.screenId) : undefined;
  if (!Component) return <ScreenNotYetBuilt />;
  return <Component />;
}
