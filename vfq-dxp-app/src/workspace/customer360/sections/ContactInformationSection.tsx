import type { Customer360Data } from '../../../engines/customer360Engine';
import { ContactSection } from './ContactSection';
import { ConsentSection, DocumentsSection } from './MiscSections';

/** Customer 360's "Contact Information" tab: authorized contacts (former
 * Contacts tab) plus consent/preferences and identity/CAF attachments -
 * customer360-fields.json's Contact Information topic already covers ID
 * Number/Type/Status and Preferred Language, which is exactly what these
 * two former tabs carried. */
export function ContactInformationSection({
  data,
  onTicketCreated,
}: {
  data: Customer360Data;
  onTicketCreated: (ticket: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-8">
      <ContactSection data={data} onTicketCreated={onTicketCreated} />
      <ConsentSection data={data} />
      <DocumentsSection data={data} />
    </div>
  );
}
