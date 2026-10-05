import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { cafSummary } from './stepSummaries';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/cafTypes';
import type { AdditionalDocument } from '../../../components/domain/AdditionalDocumentsUpload';
import type { TncLegalFacts } from '../../../components/patterns/checkoutSummaryModel';
import type { SummaryTable } from '../../../components/patterns/CheckoutSummaryTables';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';

export function cafStep(): WizardStep {
  return {
    key: 'caf',
    summary: cafSummary,
    label: 'CAF & Signature',
    render: ({ values, setValue, goNext }) => (
      <CafSignatureCapture
        value={
          (values.caf as {
            cafType?: CafType;
            signatureDataUrl?: string;
            additionalDocuments?: AdditionalDocument[];
          }) ?? {}
        }
        onChange={(v) => setValue('caf', v)}
        customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
        // Built from the totals CHECKOUT computed (checkoutTotals) plus
        // the plan/number facts already on `values`, so the figures the
        // customer signs against are the same objects the previous step
        // displayed - not a second calculation that could drift.
        orderSummary={values.cafSummary as { label: string; value: string }[] | undefined}
        summaryTables={values.cafTables as SummaryTable[] | undefined}
        inlineSignaturePad
        maxAdditionalDocuments={5}
        documentLabelOptions={['Employer Letter', 'Utility Bill', 'Proof of Address', 'Office ID Card', 'Other']}
        termsUrl="https://www.vodafone.qa/en/terms-and-conditions"
        // Auto device detection + customer-facing signing + dynamic
        // T&C bullets + locked-after-signing behaviour, all opted
        // into here only (2026-09-28) - the other five journeys
        // sharing this component keep the original manual picker.
        autoDetectDeviceType
        legalFacts={values.legalFacts as TncLegalFacts | undefined}
        // Wizard chrome (rail, Back/Continue footer) is hidden AFTER
        // signing now, not before (2026-09-30 - see customerFacing
        // below) - so once signed, this step's own content is the
        // only way forward, and it needs the same goNext the wizard
        // footer would otherwise have called.
        onContinue={goNext}
        requireTermsAgreement
      />
    ),
    isValid: (values) => {
      const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
      if (!c?.cafType) return false;
      return c.cafType !== 'Digital' || Boolean(c.signatureDataUrl);
    },
    // "The first and only step where the customer-facing view is
    // presented" - reversed 2026-09-30: the rail/footer now stay up
    // WHILE awaiting signature (the agent is still driving; Continue
    // is simply disabled by isValid until signed) and disappear only
    // once signed, the instant this same "signed" predicate flips
    // true - the same one isValid/locksAfter already use, so the
    // three cannot disagree about what "signed" means. The signed
    // customer-facing view supplies its own way forward (the
    // Continue button CafSignatureCapture renders when `signed`,
    // calling the `onContinue` this step wires to goNext) since the
    // wizard's own footer is gone at that point.
    customerFacing: (values) => {
      const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
      return Boolean(c?.cafType) && (c?.cafType !== 'Digital' || Boolean(c?.signatureDataUrl));
    },
    // "Once CAF is signed, disable/remove Back navigation and prevent
    // all edits" (2026-09-28) - the SAME signed predicate as isValid
    // above, reused rather than restated.
    locksAfter: (values) => {
      const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
      return Boolean(c?.cafType) && (c?.cafType !== 'Digital' || Boolean(c?.signatureDataUrl));
    },
  };
}
