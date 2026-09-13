import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { MySalesOrders } from '../../modules/order-management/MySalesOrders';
import { OrderApprovalQueue } from '../../modules/order-management/OrderApprovalQueue';

// Cross-customer order workspace — the standalone counterpart to Customer
// 360's Orders tab. Wraps the two existing order-management screens
// unchanged (own submitted orders vs. the approval queue) rather than
// re-implementing their table/queue logic.
const TABS: TabItem[] = [
  { key: 'mine', label: 'My Orders', content: <MySalesOrders padded={false} /> },
  { key: 'approval', label: 'Approval Queue', content: <OrderApprovalQueue padded={false} /> },
];

export function OrdersWorkspace() {
  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-6">Orders</h1>
      <Tabs items={TABS} />
    </div>
  );
}
