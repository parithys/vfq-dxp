import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { RoleAccessSection } from './RoleAccessSection';
import { BellNotificationsSection } from './BellNotificationsSection';
import { BulkNotesConfigSection } from './BulkNotesConfigSection';
import { PageHeader } from '../../components/patterns/PageHeader';

// The home for backoffice/config-oriented capabilities: the role/access
// directory (existing) plus Agent 360's Bell Notification (BIN) and Bulk
// Notes (BNT) configuration screens - both genuinely new capabilities, not
// placeholders, added alongside the original viewer rather than replacing it.
const TABS: TabItem[] = [
  { key: 'roles', label: 'Roles & Access', content: <RoleAccessSection /> },
  { key: 'bell', label: 'Bell Notifications', content: <BellNotificationsSection /> },
  { key: 'bulk-notes', label: 'Bulk Notes', content: <BulkNotesConfigSection /> },
];

export function AdministrationWorkspace() {
  return (
    <div className="p-8">
      <PageHeader title={<>Administration</>} description={<>Operational role directory, feature-grant matrix, and backoffice notification tools.</>} />
      <Tabs items={TABS} />
    </div>
  );
}
