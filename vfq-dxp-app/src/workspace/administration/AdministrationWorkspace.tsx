import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { PersonaRbacSection } from './PersonaRbacSection';
import { BellNotificationsSection } from './BellNotificationsSection';
import { BulkNotesConfigSection } from './BulkNotesConfigSection';

// The home for backoffice/config-oriented capabilities: persona/RBAC
// directory (existing) plus Agent 360's Bell Notification (BIN) and Bulk
// Notes (BNT) configuration screens — both genuinely new capabilities, not
// placeholders, added alongside the original persona viewer rather than
// replacing it.
const TABS: TabItem[] = [
  { key: 'personas', label: 'Personas & RBAC', content: <PersonaRbacSection /> },
  { key: 'bell', label: 'Bell Notifications', content: <BellNotificationsSection /> },
  { key: 'bulk-notes', label: 'Bulk Notes', content: <BulkNotesConfigSection /> },
];

export function AdministrationWorkspace() {
  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Administration</h1>
      <p className="text-fg-2 mb-6">Persona directory, role-based access matrix, and backoffice notification tools.</p>
      <Tabs items={TABS} />
    </div>
  );
}
