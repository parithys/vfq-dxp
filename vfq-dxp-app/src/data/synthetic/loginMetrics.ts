// Synthetic "today" figures on the login page's hero panel. They are illustrative - there is no live
// metrics feed behind the sign-in screen - and `icon` names an icon in LoginPage's own ICONS set.
export interface LoginMetric {
  icon: 'shield' | 'star' | 'users' | 'clock' | 'checkCircle' | 'gift';
  trend: 'up' | 'flat';
  value: string;
  label: string;
  sub: string;
}

export const LOGIN_METRICS: LoginMetric[] = [
  { icon: 'shield', trend: 'up', value: '98.7%', label: 'SLA compliance', sub: 'vs 97.5% target' },
  { icon: 'star', trend: 'up', value: '4.6 / 5', label: 'Customer satisfaction', sub: 'CSAT score today' },
  { icon: 'users', trend: 'up', value: '287', label: 'Requests processed', sub: 'customer requests today' },
  { icon: 'clock', trend: 'flat', value: '14', label: 'Work orders pending', sub: 'awaiting assignment' },
  { icon: 'checkCircle', trend: 'up', value: '56', label: 'Work orders closed', sub: 'completed today' },
  { icon: 'gift', trend: 'up', value: '18', label: 'Sales opportunities', sub: 'created today' },
];
