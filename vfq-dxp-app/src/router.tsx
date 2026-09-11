import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './modules/Dashboard';
import { ModuleScreenList } from './modules/ModuleScreenList';
import { ScreenRouteResolver } from './modules/ScreenRouteResolver';
import { NotFound } from './modules/NotFound';
import { CustomerSearchPage } from './workspace/customer-search/CustomerSearchPage';
import { Customer360Layout } from './workspace/customer360/Customer360Layout';
import { SalesWorkspace } from './workspace/sales/SalesWorkspace';
import { SupportWorkspace } from './workspace/support/SupportWorkspace';
import { OrdersWorkspace } from './workspace/orders/OrdersWorkspace';
import { AdministrationWorkspace } from './workspace/administration/AdministrationWorkspace';

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
import './modules/sim-number-management/screens';
import './modules/trouble-ticketing-complaints/screens';
import './modules/pre-to-post-migration/screens';

// Generated from config/routes.json's module list (16) + config/routes.json's
// 213 individual screen paths, per folder-structure.md's "Route generation" note.
// A single dynamic `/:moduleSlug` route (not one static route per module) so
// useParams() actually receives moduleSlug — react-router v6 ranks
// `/:moduleSlug/:screenSlug` as more specific automatically, so route order
// here doesn't matter.
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      {/* Customer -> Product -> Action redesign: new customer-centric routes,
          added alongside the legacy module routes below (not replacing
          them) — every existing screen stays reachable at its current URL. */}
      <Route path="/customer-search" element={<CustomerSearchPage />} />
      <Route path="/customer/:customerId" element={<Customer360Layout />} />
      <Route path="/sales" element={<SalesWorkspace />} />
      <Route path="/support" element={<SupportWorkspace />} />
      <Route path="/orders" element={<OrdersWorkspace />} />
      <Route path="/administration" element={<AdministrationWorkspace />} />
      {/* Legacy: the 213-screen catalogue, kept mounted for direct-link
          access and internal QA (ModuleScreenList's Built/Not-built view) —
          no longer linked from the primary sidebar. */}
      <Route path="/:moduleSlug" element={<ModuleScreenList />} />
      <Route path="/:moduleSlug/:screenSlug" element={<ScreenRouteResolver />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
