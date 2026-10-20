/**
 * Customer segments, as the business defines them: the ONE list. Anything that offers a segment (the Customer 360 account edit), recognises one
 * (the VIP tag, a business customer) or defaults by one reads it from here.
 *
 *   Consumer     Consumer, Consumer (HRN), Safwa, Safwa+, Royal
 *   Enterprise   Small Business, Medium Business, Large Business, Government
 *
 * "Premium" is not a segment. A record still carrying a value that is not on this list (an older "Enterprise (EBU)") keeps it and is shown as it is;
 * nothing here maps it to another segment.
 */
export interface SegmentGroup {
  group: 'Consumer' | 'Enterprise';
  segments: readonly string[];
}

export const SEGMENT_GROUPS: readonly SegmentGroup[] = [
  { group: 'Consumer', segments: ['Consumer', 'Consumer (HRN)', 'Safwa', 'Safwa+', 'Royal'] },
  { group: 'Enterprise', segments: ['Small Business', 'Medium Business', 'Large Business', 'Government'] },
];

export const ALL_SEGMENTS: readonly string[] = SEGMENT_GROUPS.flatMap((g) => g.segments);

/** The group a configured segment belongs to; undefined for a value that is not on the list. */
export const segmentGroupOf = (segment: string | undefined): SegmentGroup['group'] | undefined => SEGMENT_GROUPS.find((g) => segment && g.segments.includes(segment))?.group;

/** The segments that carry the VIP tag in Customer 360, and what the tag says. */
const VIP_TAGS: Readonly<Record<string, string>> = { Safwa: 'VIP', 'Safwa+': 'VVIP', Royal: 'Royal' };
export const vipTagOf = (segment: string | undefined): string | undefined => (segment ? VIP_TAGS[segment] : undefined);
