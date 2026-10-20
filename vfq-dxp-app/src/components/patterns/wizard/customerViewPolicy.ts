/**
 * Where a guided journey offers "Customer view" (the pop-up that shows the step to the customer). ONE list for every journey, keyed by the
 * shared step keys - a step that is not named here never shows the button, whichever journey it is in:
 * Recommended Offers (crossSales), Offers & Plans (plan), Add-ons (addons, planExtras), Checkout (checkout), CAF & Signature (caf) and the MNP Form (donor-attachment, which the customer signs).
 * Order Submitted (the page after the last step, shown by the Activation Complete capability) is the sixth, under its own key.
 */
export const ORDER_SUBMITTED_KEY = 'order-submitted';
export const CUSTOMER_VIEW_STEP_KEYS: readonly string[] = ['crossSales', 'plan', 'addons', 'planExtras', 'checkout', 'caf', 'donor-attachment', ORDER_SUBMITTED_KEY];

export const hasCustomerView = (stepKey: string | undefined): boolean => stepKey !== undefined && CUSTOMER_VIEW_STEP_KEYS.includes(stepKey);
