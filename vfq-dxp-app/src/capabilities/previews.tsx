import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityComments } from './ActivityComments';
import { AppointmentBooking } from './AppointmentBooking';
import { BillingAccount } from './BillingAccount';
import { CafSignature } from './CafSignature';
import { CustomerIdentification } from './CustomerIdentification';
import { NumberSelection } from './NumberSelection';
import { Payment } from './Payment';
import { PlanSelection } from './PlanSelection';
import { ServiceAddress } from './ServiceAddress';
import { SimType } from './SimType';

// Live previews for the Capability Library page: the REAL capability component with throwaway local state, so what
// the library shows is exactly what every journey renders - a change to the capability shows here and there.

function Identification() {
  const [v, setV] = useState({});
  return <CustomerIdentification value={v} onChange={setV} />;
}
function Number() {
  const [n, setN] = useState<string | undefined>();
  return <NumberSelection value={n} onChange={(m) => setN(m)} />;
}
function Billing() {
  const [v, setV] = useState({});
  return <BillingAccount mode="settings" value={v} onChange={setV} />;
}
function Address() {
  const [v, setV] = useState({});
  return <ServiceAddress mode="structured" value={v} onChange={setV} />;
}
function Plan() {
  const [p, setP] = useState<string | undefined>();
  const [d, setD] = useState<string | undefined>();
  return <PlanSelection kind="prepaid" selectedProductId={p} onSelectProduct={setP} discountId={d} onSelectDiscount={setD} />;
}
function Caf() {
  const [v, setV] = useState({});
  return <CafSignature value={v} onChange={setV} customerName="Sample Customer" />;
}
function Pay() {
  const [v, setV] = useState({});
  return <Payment amountDueQAR={120} value={v} onChange={setV} />;
}
function Appointment() {
  const [v, setV] = useState({});
  return <AppointmentBooking value={v} onChange={setV} />;
}
function Activity() {
  const [c, setC] = useState('');
  const [ch, setCh] = useState('Appointment');
  return <ActivityComments value={c} onChange={setC} channel={{ value: ch, onChange: setCh, options: ['Appointment', 'Walk-in', 'Call Center'] }} />;
}

function Sim() {
  const [v, setV] = useState({});
  return <SimType value={v} onChange={setV} customerEmail="sample.customer@example.qa" />;
}

export const CAPABILITY_PREVIEWS: Record<string, () => ReactNode> = {
  'customer-identification': () => <Identification />,
  'number-selection': () => <Number />,
  'billing-account': () => <Billing />,
  'service-address': () => <Address />,
  'plan-selection': () => <Plan />,
  'caf-signature': () => <Caf />,
  payment: () => <Pay />,
  'appointment-booking': () => <Appointment />,
  'activity-comments': () => <Activity />,
  'sim-type': () => <Sim />,
};
