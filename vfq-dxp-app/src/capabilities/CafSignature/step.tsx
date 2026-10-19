import type { ReactNode } from 'react';
import { CAF_SIGNATURE_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { CafSignature } from './CafSignature';
import { cafSummary } from './summary';
import type { TncLegalFacts } from '../../components/patterns/checkoutSummaryModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import type { CafType } from '../../components/patterns/cafTypes';

/** The captured CAF: its type and, once signed on this device, the signature. */
export type CafValue = { cafType?: CafType; signatureDataUrl?: string };

/**
 * Whether the CAF step may continue: a type is chosen and, for the types that are signed on this device,
 * the signature is captured. By default the CAF types signed on the device (Digital on the web, Touch Screen on a tablet) need it.
 */
export function isCafValid(caf: CafValue | undefined, needsSignature: (type: CafType) => boolean = (type) => type === 'Digital' || type === 'Touch Screen'): boolean {
  if (!caf?.cafType) return false;
  return !needsSignature(caf.cafType) || Boolean(caf.signatureDataUrl);
}

/**
 * The CAF is signed - the point from which the journey locks. The full variant picks the CAF type from the device and
 * both outcomes (Digital on a pointer device, Touch Screen on a tablet) are signed on this screen, so both need the
 * signature; only a CAF type signed elsewhere (paper) counts as done once chosen.
 */
const cafSigned = (values: Record<string, unknown>) => {
  const c = values.caf as CafValue | undefined;
  const signedHere = c?.cafType === 'Digital' || c?.cafType === 'Touch Screen';
  return Boolean(c?.cafType) && (!signedHere || Boolean(c?.signatureDataUrl));
};

/**
 * CAF & Signature, stored under `caf`.
 *
 *   variant 'standard' (default)  `customerName` reads the customer's name from the values; `keyInformation` are
 *                      statements shown before signing; `idDocument` the ID the CAF reads back; `autoDetectDevice`
 *                      sets the CAF type from the device in use; `needsSignature` says which CAF types are signed
 *                      on this device (default: only Digital).
 *   variant 'full'     New Connection / Fixed Line: the customer reads back the order the Checkout step computed
 *                      (cafSummary / legalFacts on the values), signs on an inline pad and agrees to the
 *                      terms. Once signed the wizard chrome goes (the customer-facing view) and the journey locks;
 *                      the signed view's own Continue calls goNext. `termsScrollMode: 'page'` for the pop-up.
 */
export function cafSignatureStep(
  opts: {
    variant?: 'standard' | 'full';
    customerName?: (values: Record<string, unknown>) => string | undefined;
    keyInformation?: (values: Record<string, unknown>) => ReactNode[] | undefined;
    idDocument?: (values: Record<string, unknown>) => { label?: string; value?: string } | undefined;
    autoDetectDevice?: boolean;
    needsSignature?: (type: CafType) => boolean;
    termsScrollMode?: 'container' | 'page';
    /** Key Information read from the business-maintained statements whose scenario key starts with this (e.g. 'prepaid-'). */
    keyInformationScenario?: string;
    /** Full variant: which journey's form and Terms & Conditions (postpaid by default). */
    journey?: 'postpaid' | 'prepaid';
    /** Full variant: extra rows on the application form, read from the values. */
    formDetails?: (values: Record<string, unknown>) => { label: string; value: string }[] | undefined;
  } = {}
): WizardStep {
  if (opts.variant === 'full') {
    return {
      key: 'caf',
      summary: cafSummary,
      label: CAF_SIGNATURE_LABEL,
      render: ({ values, setValue, goNext }) => (
        <CafSignature
          variant="full"
          value={(values.caf as CafValue) ?? {}}
          onChange={(v) => setValue('caf', v)}
          customerName={
            opts.customerName?.(values) ?? (values.contact as GuidedContactValue | undefined)?.moiResult?.name
          }
          keyInformation={opts.keyInformation?.(values)}
          keyInformationScenario={opts.keyInformationScenario}
          idLabel={opts.idDocument?.(values)?.label}
          idValue={opts.idDocument?.(values)?.value}
          journey={opts.journey}
          formDetails={opts.formDetails?.(values)}
          // Built from the totals CHECKOUT computed plus the plan/number facts already on `values`, so the figures
          // the customer signs against are the same objects the previous step displayed - not a second calculation.
          orderSummary={values.cafSummary as { label: string; value: string }[] | undefined}
          fullTerms
          legalFacts={values.legalFacts as TncLegalFacts | undefined}
          // The wizard chrome is hidden AFTER signing, so once signed this step's own content is the only way
          // forward and needs the goNext the wizard footer would otherwise have called.
          onContinue={goNext}
          termsScrollMode={opts.termsScrollMode}
        />
      ),
      isValid: (values) => cafSigned(values),
      // "The first and only step where the customer-facing view is presented": the rail/footer stay up WHILE
      // awaiting signature and disappear only once signed - the same predicate isValid and locksAfter use, so the
      // three cannot disagree about what "signed" means.
      customerFacing: cafSigned,
      // "Once CAF is signed, disable/remove Back navigation and prevent all edits."
      locksAfter: cafSigned,
    };
  }
  return {
    key: 'caf',
    summary: cafSummary,
    label: CAF_SIGNATURE_LABEL,
    render: ({ values, setValue }) => (
      <CafSignature
        value={(values.caf as CafValue) ?? {}}
        onChange={(v) => setValue('caf', v)}
        customerName={opts.customerName?.(values)}
        keyInformation={opts.keyInformation?.(values)}
        idLabel={opts.idDocument?.(values)?.label}
        idValue={opts.idDocument?.(values)?.value}
        autoDetectDeviceType={opts.autoDetectDevice}
      />
    ),
    isValid: (values) => isCafValid(values.caf as CafValue | undefined, opts.needsSignature),
  };
}
