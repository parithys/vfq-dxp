import { useEffect, useState } from 'react';
import { Textarea } from '../primitives/Textarea';
import { Badge } from '../primitives/Badge';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface Appointment {
  cluster: string;
  appointmentDate: string;
  timeSlot: string;
}

export interface AppointmentBookingValue {
  cluster?: string;
  date?: string;
  timeSlot?: string;
  comments?: string;
}

interface AppointmentBookingStepProps {
  value: AppointmentBookingValue;
  onChange: (value: AppointmentBookingValue) => void;
}

const CLUSTERS = ['West Bay Cluster', 'Al Sadd Cluster', 'Pearl Cluster'];
const TIME_SLOTS = ['8AM–11AM', '11AM–2PM', '2PM–5PM', '5PM–8PM'];
const SLOT_CAPACITY = 5;

function nextAvailableDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

// Pattern 9: Appointment Booking Modal - cluster selection (radio group) ->
// calendar grid (next available date pre-selected) -> time-slot pills showing
// live capacity ("14/15") -> optional booking comments; bounded by the
// location's SLA cluster (SCR-028/049/083/109/115). Book Appointment fields
// (FLD-372–377): Collect QID/CAF/FNP Identifier handled by the caller.
export function AppointmentBookingStep({ value, onChange }: AppointmentBookingStepProps) {
  const [existing, setExisting] = useState<Appointment[]>([]);

  useEffect(() => {
    mockDataEngine.list<Appointment>('appointments').then(setExisting);
    if (!value.date) onChange({ ...value, date: nextAvailableDate() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usedInSlot = (cluster: string, date: string, slot: string) =>
    existing.filter((a) => a.cluster === cluster && a.appointmentDate === date && a.timeSlot === slot).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[length:var(--fs-label)] text-fg-2 mb-1">SLA Cluster</div>
        <div className="flex gap-2 flex-wrap">
          {CLUSTERS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...value, cluster: c })}
              className={`px-3 py-1.5 rounded-[var(--radius-pill)] border text-[length:var(--fs-body)] ${
                value.cluster === c ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)] text-[var(--field-card-selected)]' : 'border-border-soft bg-bg text-fg'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[length:var(--fs-label)] text-fg-2 mb-1">Date</div>
        <input
          type="date"
          value={value.date ?? ''}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className={`rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg focus:outline-none focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)] ${
            value.date ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'
          }`}
        />
      </div>

      {value.cluster && value.date && (
        <div>
          <div className="text-[length:var(--fs-label)] text-fg-2 mb-1">Time Slot</div>
          <div className="flex gap-2 flex-wrap">
            {TIME_SLOTS.map((slot) => {
              const used = usedInSlot(value.cluster!, value.date!, slot);
              const full = used >= SLOT_CAPACITY;
              const selected = value.timeSlot === slot;
              return (
                <button
                  key={slot}
                  disabled={full}
                  onClick={() => onChange({ ...value, timeSlot: slot })}
                  className={`px-3 py-1.5 rounded-[var(--radius-pill)] border text-[length:var(--fs-body)] disabled:opacity-40 disabled:cursor-not-allowed
                    ${selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)] text-[var(--field-card-selected)]' : 'border-border-soft bg-bg text-fg'}`}
                >
                  {slot} <Badge variant={full ? 'danger' : 'filled-neutral'}>{used}/{SLOT_CAPACITY}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Textarea
        label="Booking Comments"
        value={value.comments ?? ''}
        onChange={(e) => onChange({ ...value, comments: e.target.value })}
      />
    </div>
  );
}
