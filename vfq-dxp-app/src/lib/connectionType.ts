// What kind of connection a service is, and the one colour it is shown in everywhere (list tags, plan cards, summaries):
//   Postpaid = violet, Prepaid = green, Home Internet = amber, everything else = neutral grey.
// Keyed by the service category used across Customer 360 (customerServicesEngine's ServiceCategory), kept as plain strings
// here so this file imports nothing from the app.

export type ConnectionTagVariant = 'tag-violet' | 'tag-green' | 'tag-amber' | 'filled-neutral';
/** The same colours as C360Kit's tone names, for icon tiles that sit beside a tag. */
export type ConnectionTagTone = 'purple' | 'green' | 'amber' | 'grey';

export interface ConnectionTag {
  label: string;
  variant: ConnectionTagVariant;
  tone: ConnectionTagTone;
}

export const CONNECTION_TAG: Record<string, ConnectionTag> = {
  Postpaid: { label: 'Postpaid', variant: 'tag-violet', tone: 'purple' },
  Prepaid: { label: 'Prepaid', variant: 'tag-green', tone: 'green' },
  'GigaHome Fibre': { label: 'Home Internet', variant: 'tag-amber', tone: 'amber' },
  'GigaHome 5G': { label: 'Home Internet (5G)', variant: 'tag-amber', tone: 'amber' },
  'TV / Entertainment': { label: 'TV', variant: 'filled-neutral', tone: 'grey' },
  'Fixed Line': { label: 'Fixed Line', variant: 'filled-neutral', tone: 'grey' },
  'Smart Devices': { label: 'Smart Device', variant: 'filled-neutral', tone: 'grey' },
  Other: { label: 'Other service', variant: 'filled-neutral', tone: 'grey' },
};

/** The tag for a service category; an unknown category is shown neutral under its own name rather than hidden. */
export const connectionTag = (category: string): ConnectionTag => CONNECTION_TAG[category] ?? { label: category, variant: 'filled-neutral', tone: 'grey' };
