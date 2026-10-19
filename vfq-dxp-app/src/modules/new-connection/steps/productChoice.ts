import { useWorkflowStore } from '../../../stores/workflowStore';
import { useCustomerContext } from '../../../stores/customerContextStore';
import { HOME_WIZARD_ID_BY_FLOW } from '../newConnectionModel';
import type { CrossSalesValue } from '../../../capabilities';
import { PRODUCT_OWNED_KEYS, eligibilityJourney } from '../products';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ConnectionProduct, HomeProduct, MnpType } from '../products';
import type { ProductStepContext } from './ProductSelection';

/** The step's position in the wizard: right after Customer Identification. Switching product returns progress to it. */
export const PRODUCT_STEP_INDEX = 1;

/**
 * Chooses the product (and, for MNP and Fixed Line, which kind) in place. Changing product drops what the previous one chose
 * and pulls progress back to this step (see PRODUCT_OWNED_KEYS); an offer accepted for another product no longer applies.
 * With `advance`, the step moves on by itself once the chosen product's eligibility is clear (the footer buttons of the
 * mobile Product Selection page); without it, the agent presses Continue (the home product cards).
 * Returns false when nothing changed (the same choice again).
 */
export function selectProduct(
  ctx: ProductStepContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void,
  next: ConnectionProduct,
  opts: { mnpType?: MnpType; homeProduct?: HomeProduct; advance?: boolean } = {}
): boolean {
  const product = values.product as ConnectionProduct | undefined;
  const mnpType = next === 'mnp' ? opts.mnpType : undefined;
  const homeProduct = next === 'fixed-line' ? opts.homeProduct : undefined;
  if (next === product && mnpType === (values.mnpType as MnpType | undefined) && homeProduct === (values.homeProduct as HomeProduct | undefined)) return false;
  useWorkflowStore.getState().patchDraft(ctx.wizardId, {
    set: { product: next, productPreselected: Boolean(opts.advance), mnpType, homeProduct },
    unset: PRODUCT_OWNED_KEYS,
    progressTo: PRODUCT_STEP_INDEX,
  });
  if ((values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted') ctx.applyCrossSales(setValue, { decision: 'declined' });
  return true;
}

/** Whether eligibility has been judged for the product now chosen (and its kind, for Fixed Line), and nothing stops the order. */
export function productEligibilityClear(values: Record<string, unknown>): boolean {
  const e = values.eligibility as EligibilityResult | undefined;
  // Fixed Line needs its connection type here; MNP's plan type is asked on the step after (it is judged there, for the type chosen).
  const needsKind = values.product === 'fixed-line' && !values.homeProduct;
  return !needsKind && Boolean(e) && e!.scope === 'product' && e!.journeyType === eligibilityJourney(values) && !e!.hardStop && !e!.softStop;
}

/** The plan type of a New MNP journey (Postpaid / Prepaid). Changing it drops what the other type chose, as changing product does, and returns progress to the plan-type step. */
export const MNP_TYPE_STEP_INDEX = PRODUCT_STEP_INDEX + 1;
export function selectMnpType(
  ctx: ProductStepContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void,
  type: MnpType
): boolean {
  void setValue;
  if (values.mnpType === type && values.mnpTypeUnchosen !== true) return false;
  useWorkflowStore.getState().patchDraft(ctx.wizardId, { set: { mnpType: type, mnpTypeUnchosen: false }, unset: PRODUCT_OWNED_KEYS, progressTo: MNP_TYPE_STEP_INDEX });
  return true;
}

/** Eligibility is clear AND nothing routes the order for approval: the cases that need no look from the agent before moving on. */
export const clearAndQuiet = (values: Record<string, unknown>) =>
  productEligibilityClear(values) && !(values.eligibility as EligibilityResult).checks.some((c) => c.outcome === 'approval-routing');

/**
 * Moves the customer from New Connection to New Home Connection without asking them to be identified again, and without the
 * "Leave this journey?" prompt: nothing is abandoned or left half-done, the journey simply continues as the home one. The
 * identity, the eligibility and the customer type already gathered are carried into the home draft, which opens at Product
 * Selection; the customer hold passes to it; and this journey's draft is cleared (its progress was only identification).
 */
export function handOverToHomeConnection(ctx: ProductStepContext, values: Record<string, unknown>, route: string): void {
  const store = useWorkflowStore.getState();
  const home = HOME_WIZARD_ID_BY_FLOW.new;
  store.clearDraft(home);
  store.patchDraft(home, {
    set: { contact: values.contact, eligibility: values.eligibility, customerType: values.customerType },
    progressTo: PRODUCT_STEP_INDEX,
  });
  useCustomerContext.getState().endJourney(ctx.wizardId);
  // Cleared last: the leave-journey guard asks only while the draft has progress, and it has none now.
  store.clearDraft(ctx.wizardId);
  ctx.navigate(route);
}
