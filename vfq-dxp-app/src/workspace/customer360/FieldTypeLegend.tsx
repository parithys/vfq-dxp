import { SHOW_REQUIREMENT_COVERAGE } from './requirementCoverage';

// Explains the two field colours the overlay applies (see requirementCoverage.ts).
export function FieldTypeLegend() {
  if (!SHOW_REQUIREMENT_COVERAGE) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 text-fg-2 text-[length:var(--fs-caption)]" aria-label="Field colour legend">
      <span className="font-medium">Field type:</span>
      <span className="inline-flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-realtime" aria-hidden="true" />
        <span className="text-realtime font-medium">Real Time</span> - fetched live from the source system
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-drilldown" aria-hidden="true" />
        <span className="text-drilldown font-medium">Drill Down / Select</span> - opens further detail, or is chosen from a list
      </span>
    </div>
  );
}
