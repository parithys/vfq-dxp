import { useEffect, useState } from 'react';
import { loadConfigFile } from '../../../engines/configEngine';
import type { CustomerService } from '../../../engines/customerServicesEngine';

export interface QueryIssue {
  id: string;
  name: string;
  /** Absent until the issue-to-category mapping is supplied. */
  category?: string;
  /** The issue's default Query Service Type - decides Complaints vs Requests. Absent = Complaints. */
  serviceType?: string;
  /** The matching real Siebel VFQA_TT_ACTUAL_ISSUE value, where one exists. */
  ticketActualIssue?: string;
  /** Ticket classification from the categorization workbook. */
  summary?: string;
  subSummary?: string;
  area?: string;
  subArea?: string;
  keywords?: string[];
}

/** Which Details fields the Preview shows for one Query Category + Query Service Type, in order. */
export interface PreviewColumn {
  category: string;
  serviceType: string;
  fields: string[];
}

export interface QueryIssueCatalogue {
  examples: string[];
  issues: QueryIssue[];
  preview: PreviewColumn[];
}

/** The six choices offered when no MSISDN is selected. */
export const QUERY_SERVICE_TYPES = [
  'Mobile Complaints',
  'Fixed/5G Complaints',
  'Mobile/Fixed/5G Complaints',
  'Mobile Requests',
  'Fixed/5G Requests',
  'Any',
] as const;

let loaded: Promise<QueryIssueCatalogue | undefined> | undefined;
export function useQueryIssueCatalogue(): QueryIssueCatalogue | undefined {
  const [cat, setCat] = useState<QueryIssueCatalogue | undefined>();
  useEffect(() => {
    loaded ??= loadConfigFile<QueryIssueCatalogue>('query-issues.json').catch(() => undefined);
    let cancelled = false;
    void loaded.then((c) => !cancelled && setCat(c));
    return () => {
      cancelled = true;
    };
  }, []);
  return cat;
}

export const searchQueryIssues = (issues: QueryIssue[], term: string): QueryIssue[] => {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  return issues.filter((i) => [i.name, i.category ?? '', ...(i.keywords ?? [])].some((t) => t.toLowerCase().includes(q)));
};

/**
 * Query Service Type from a selected MSISDN: the line decides Mobile vs Fixed/5G, the issue's own default service type
 * decides Complaints vs Requests. Undefined when the line is neither (nothing to derive from).
 */
export function deriveQueryServiceType(issue: QueryIssue, service: CustomerService | undefined): string | undefined {
  if (!service) return undefined;
  const line = service.tab === 'mobile' ? 'Mobile' : service.tab === 'fibre' ? 'Fixed/5G' : undefined;
  if (!line) return undefined;
  return `${line} ${/request/i.test(issue.serviceType ?? '') ? 'Requests' : 'Complaints'}`;
}

/** The Trouble Ticket issue types the existing ticket form accepts; other service types leave the choice to the agent. */
export const TICKET_ISSUE_TYPES = ['Mobile Complaints', 'Fixed/5G Complaints'];

/**
 * The Details fields for a category + service type. Exact match first; then the category's "Any" column; then a
 * column of the same category on the same line (Mobile / Fixed); then the category's first column.
 */
export function previewFieldsFor(catalogue: QueryIssueCatalogue, category: string | undefined, serviceType: string): string[] {
  const cols = catalogue.preview.filter((c) => c.category === category);
  if (cols.length === 0) return ['Account Number', 'MSISDN', 'Plan Name'];
  const line = /fixed/i.test(serviceType) ? /fixed/i : /mobile/i;
  const hit = cols.find((c) => c.serviceType === serviceType) ?? cols.find((c) => c.serviceType === 'Any') ?? cols.find((c) => line.test(c.serviceType)) ?? cols[0];
  return hit.fields;
}
