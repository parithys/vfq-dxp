import { Icon } from './Icon';
import { CARD_IDLE, CARD_SELECTED } from './offerCardParts';

const CHECK = 'M20 6L9 17l-5-5';

export interface ChoiceCard<K extends string = string> {
  key: K;
  label: string;
  /** SVG path (24px grid) for the tile. */
  icon: string;
}

/**
 * A single choice shown as a row of icon cards - the same card as the ID type choice: an icon tile over the label, a red
 * border, pink wash and tick mark on the chosen one. Use it instead of a row of radio buttons. `legend` names the group.
 */
export function ChoiceCards<K extends string>({
  legend,
  name,
  items,
  value,
  onChange,
}: {
  legend: string;
  /** Accessible name of the group (defaults to the legend). */
  name?: string;
  items: ChoiceCard<K>[];
  value: K | undefined;
  onChange: (key: K) => void;
}) {
  return (
    <div>
      <p className="text-fg-2 text-[length:var(--fs-label)] mb-2">{legend}</p>
      <div role="radiogroup" aria-label={name ?? legend} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))] gap-3">
        {items.map((t) => {
          const selected = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t.key)}
              className={`relative flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                selected ? `${CARD_SELECTED} text-[var(--field-card-selected)]` : `${CARD_IDLE} text-fg`
              }`}
            >
              {selected && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-[var(--radius-pill)] bg-[var(--field-card-selected)] text-on-dark flex items-center justify-center">
                  <Icon path={CHECK} className="w-2.5 h-2.5" />
                </span>
              )}
              <span className={`inline-flex p-2 rounded-[var(--radius-card)] ${selected ? 'bg-[var(--field-card-selected)] text-on-dark' : 'bg-[var(--icon-tile-bg)] text-[var(--icon-tile-fg)]'}`}>
                <Icon path={t.icon} className="w-6 h-6" />
              </span>
              <span className="text-[length:var(--fs-caption)] font-bold text-center">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
