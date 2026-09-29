import { DataTable } from '../../../components/primitives/DataTable';
import type { Customer360Data } from '../../../engines/customer360Engine';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">{children}</h3>;
}

/** Customer 360's "Contact/Assets Information" tab: targeted cross-sell
 * offers (data.crossSalesOffers) and device-on-installment plans
 * (data.deviceInstallments), matching customer360-fields.json's
 * Contact/Assets Information topic (CVM/targeted offers, Eligible Discount,
 * Next Best Offer, DOI Eligibility). */
export function ContactAssetsInformationSection({ data }: { data: Customer360Data }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Targeted Offers</SectionTitle>
        <DataTable
          rows={data.crossSalesOffers}
          rowKey={(r) => String(r.offerId)}
          emptyMessage="No targeted cross-sell offers on file for this customer's contacts."
          columns={[
            { key: 'offerName', header: 'Offer' },
            { key: 'offerType', header: 'Type' },
            { key: 'priorityCode', header: 'Priority' },
            { key: 'price', header: 'Price (QAR)' },
            { key: 'status', header: 'Status' },
          ]}
        />
      </section>
      <section>
        <SectionTitle>Device Installments (DOI)</SectionTitle>
        <DataTable
          rows={data.deviceInstallments}
          rowKey={(r) => String(r.id)}
          emptyMessage="No device installment plans on file for this customer's accounts."
          columns={[
            { key: 'deviceName', header: 'Device' },
            { key: 'devicePriceQar', header: 'Price (QAR)' },
            { key: 'installmentMonths', header: 'Term (months)' },
            { key: 'monthlyInstallmentQar', header: 'Monthly (QAR)' },
            { key: 'eligibilityListMembership', header: 'DOI Eligibility' },
            { key: 'status', header: 'Status' },
          ]}
        />
      </section>
    </div>
  );
}
