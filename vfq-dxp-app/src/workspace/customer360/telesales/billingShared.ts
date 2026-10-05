import { type Ctx } from './TelesalesOverview';
import { type Rec } from './shared';

export const catalogOf = (ctx: Ctx) => (ctx.data.demoCatalog[0] ?? {}) as Rec;

export const qar = (n: number) => `QAR ${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

export type ReactNodeLike = import('react').ReactNode;
