import { Badge } from './Badge';
import { connectionTag } from '../../lib/connectionType';

/** The connection-type tag (Postpaid violet, Prepaid green, Home Internet amber ...). Use this, not a hand-coloured pill. */
export function ConnectionTypeTag({ category, label }: { category: string; /** Overrides the default wording, keeping the colour. */ label?: string }) {
  const t = connectionTag(category);
  return <Badge variant={t.variant}>{label ?? t.label}</Badge>;
}
