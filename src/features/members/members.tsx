// Household members: colors, names and the small UI pieces that show them.
import type { CSSProperties } from 'react';
import { joinNames } from '../../core/format';
import { type MessageKey, t } from '../../i18n';
import type { Member } from '../../shared/types';

export const MEMBER_COLORS: readonly { color: string; label: MessageKey }[] = [
  { color: '#4C7DF0', label: 'color.blue' },
  { color: '#E2558A', label: 'color.pink' },
  { color: '#8B5CF6', label: 'color.violet' },
  { color: '#22A06B', label: 'color.green' },
  { color: '#F08C2E', label: 'color.orange' },
  { color: '#14A3B8', label: 'color.teal' },
  { color: '#D9483B', label: 'color.red' },
  { color: '#A16207', label: 'color.mustard' },
];

export const memberColor = (i: number) => MEMBER_COLORS[i % MEMBER_COLORS.length]?.color ?? '#4C7DF0';

/** First color nobody uses yet. */
export function nextColor(used: readonly Member[]) {
  return MEMBER_COLORS.find((c) => !used.some((m) => m.color === c.color))?.color ?? memberColor(used.length);
}

export function newMemberId() {
  return Math.random().toString(36).slice(2, 9);
}

export const byId = (members: readonly Member[]) => new Map(members.map((m) => [m.id, m]));

/** "Alex and Sam" */
export function memberNames(ids: readonly string[] | undefined, members: ReadonlyMap<string, Member>) {
  return joinNames((ids ?? []).flatMap((id) => members.get(id)?.name ?? []));
}

/** Color bar of an item, from its members (two colors when it's shared). */
export function memberColorStyle(
  ids: readonly string[] | undefined,
  members: ReadonlyMap<string, Member>,
): CSSProperties {
  const cs = (ids ?? []).flatMap((id) => members.get(id)?.color ?? []);
  return { '--c': cs[0] ?? 'var(--border-strong)', '--c1': cs[0], '--c2': cs[1] ?? cs[0] };
}

export function MemberDots({ ids, members }: { ids?: readonly string[]; members: ReadonlyMap<string, Member> }) {
  if (!ids?.length) return null;
  return (
    <span className="dots" aria-hidden="true">
      {ids.map((id) => {
        const m = members.get(id);
        return m ? <span key={id} className="dot" style={{ background: m.color }} title={m.name} /> : null;
      })}
    </span>
  );
}

export function MemberPicker({
  members,
  value,
  onChange,
  single,
}: {
  members: readonly Member[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  return (
    <div className="chips">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            style={{ '--c': m.color }}
            aria-pressed={on}
            onClick={() => onChange(single ? [m.id] : on ? value.filter((x) => x !== m.id) : [...value, m.id])}
          >
            <span className="dot" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ member }: { member: Member }) {
  return (
    <span className="avatar" style={{ '--c': member.color }} aria-hidden="true">
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ColorSwatches({
  colors,
  value,
  onChange,
}: {
  colors: readonly { color: string; label: MessageKey }[];
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own border and legend
    <div className="swatches" role="group" aria-label={t('common.color')}>
      {colors.map((c) => (
        <button
          key={c.color}
          type="button"
          className={`swatch${c.color === value ? ' on' : ''}`}
          style={{ '--sc': c.color }}
          aria-pressed={c.color === value}
          aria-label={t(c.label)}
          onClick={() => onChange(c.color)}
        />
      ))}
    </div>
  );
}
