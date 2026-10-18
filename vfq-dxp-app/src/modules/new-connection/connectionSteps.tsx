import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { customerQualificationStep } from '../../capabilities';
import type { QualificationContext } from '../../capabilities';
import type { DeviceType } from '../../lib/deviceType';
import { mnpSteps } from '../mnp-fnp-porting/screens/mnpSteps';
import { fixedLineSteps } from '../fixed-line-fibre/fixedActivation/fixedSteps';
import { prepaidSteps } from '../mobile-prepaid/screens/prepaidSteps';
import { postpaidSteps } from './postpaidSteps';
import type { PostpaidStepContext } from './postpaidSteps';
import { forProduct } from './products';
import { productStep } from './steps/productStep';
import type { ProductStepContext } from './steps/ProductSelection';

/** Everything the steps of a New Connection journey need from it (`journey`: New Connection or New Home Connection). */
export interface ConnectionStepContext extends QualificationContext, ProductStepContext, PostpaidStepContext {
  device: DeviceType;
}

/**
 * The steps of New Connection, all of them in one list: Customer Identification (once, for every product), Product
 * Selection, then each product's own steps. A product's steps are active only while it is the chosen product, so the agent
 * sees one continuous journey and the draft, the customer lock and the title never change.
 */
export function buildConnectionSteps(ctx: ConnectionStepContext): WizardStep[] {
  // New Home Connection is the same journey with only the home products: Identification, Product Selection (Fibre, Fixed-Line,
  // FWA, 5G Home), then the home steps.
  if (ctx.journey === 'home') {
    return [customerQualificationStep({ ...ctx, productAgnostic: true }), productStep(ctx), ...forProduct('fixed-line', fixedLineSteps())];
  }
  return [
    // Identification is the same for every product: scan, MOI, the eligibility checks common to all, special discounts.
    customerQualificationStep({ ...ctx, productAgnostic: true }),
    productStep(ctx),
    ...forProduct('postpaid', postpaidSteps(ctx)),
    ...forProduct('prepaid', prepaidSteps(ctx)),
    ...forProduct('fixed-line', fixedLineSteps()),
    ...forProduct('mnp', mnpSteps(ctx)),
  ];
}
