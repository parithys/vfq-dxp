import { Routes, Route } from 'react-router-dom';
import { Home } from './modules/Home';
import { ModuleScreenList } from './modules/ModuleScreenList';
import { ScreenRouteResolver } from './modules/ScreenRouteResolver';

// Side-effect imports: each module's screens/index.ts calls registerScreen()
// so router.tsx doesn't need to know which screens are implemented.
import './modules/lead-management/screens';
import './modules/mobile-prepaid/screens';
import './modules/fixed-line-fibre/screens';
import './modules/fwa-5g-home/screens';
import './modules/mobile-postpaid/screens';
import './modules/enterprise-iot-b2b/screens';
import './modules/order-management/screens';
import './modules/mnp-fnp-porting/screens';
import './modules/identity-customer-management/screens';

// Generated from config/routes.json's module list (16) + config/routes.json's
// 213 individual screen paths, per folder-structure.md's "Route generation" note.
// A single dynamic `/:moduleSlug` route (not one static route per module) so
// useParams() actually receives moduleSlug — react-router v6 ranks
// `/:moduleSlug/:screenSlug` as more specific automatically, so route order
// here doesn't matter.
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:moduleSlug" element={<ModuleScreenList />} />
      <Route path="/:moduleSlug/:screenSlug" element={<ScreenRouteResolver />} />
    </Routes>
  );
}
