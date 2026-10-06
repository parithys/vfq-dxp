import type { NavigateFunction } from 'react-router-dom';
import type { CustomerBenefit } from '../../../engines/customerBenefitEngine';
import type { CrossSalesValue } from './crossSalesModel';
import type { NewConnectionFlow, Product } from '../newConnectionModel';
import type { useJourneyCustomerLock } from '../hooks/useJourneyCustomerLock';
import type { submitNewConnectionOrder } from '../submitNewConnectionOrder';

// What the New Connection step definitions need from the wizard component's journey state.
export interface NewConnectionStepContext {
  flow: NewConnectionFlow;
  existingCustomerId: string | undefined;
  guardedContactChange: ReturnType<typeof useJourneyCustomerLock>['guardedContactChange'];
  applyCrossSales: (setValue: (field: string, value: unknown) => void, v: CrossSalesValue) => void;
  navigate: NavigateFunction;
  createRecord: Parameters<typeof submitNewConnectionOrder>[1]['createRecord'];
  customerBenefits: CustomerBenefit[] | undefined;
  products: Product[];
}
