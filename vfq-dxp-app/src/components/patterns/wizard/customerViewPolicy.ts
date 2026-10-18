/**
 * Where a guided journey offers "Customer view" (the pop-up that shows the step to the customer). ONE list for every journey, keyed by the
 * shared step keys - a step that is not named here never shows the button, whichever journey it is in:
 * Recommended Offers (crossSales), Offers & Plans (plan), Add-ons (addons, planExtras), Checkout (checkout) and CAF & Signature (caf).
 * Order Submitted is not a wizard step (the journey shell shows it after the last one), so it is not decided here.
 */
export const CUSTOMER_VIEW_STEP_KEYS: readonly string[] = ['crossSales', 'plan', 'addons', 'planExtras', 'checkout', 'caf'];

export const hasCustomerView = (stepKey: string | undefined): boolean => stepKey !== undefined && CUSTOMER_VIEW_STEP_KEYS.includes(stepKey);
