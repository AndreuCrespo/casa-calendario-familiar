// Small building blocks shared by every screen.
import { Check, type LucideIcon, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../i18n';

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="grow">
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children}
    </header>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon size={26} />
      </div>
      <b>{title}</b>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

/** Round check button; `label` names what it checks off (read by screen readers). */
export function CheckCircle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`check${on ? ' on' : ''}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? t('common.uncheckItem', { item: label }) : t('common.checkItem', { item: label })}
    >
      <Check size={16} strokeWidth={3.2} />
    </button>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label={t('common.loading')} />;
}

/** Floating "add" button. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="fab" onClick={onClick} aria-label={label}>
      <Plus size={28} />
    </button>
  );
}

export interface SegmentOption<T extends string> {
  id: T;
  label: ReactNode;
  /** Accessible name when the label is short or not text. */
  ariaLabel?: string;
}

/** Row of mutually exclusive buttons (a small toggle group). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  block,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (v: T) => void;
  label: string;
  block?: boolean;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own border and legend
    <div className={`seg${block ? ' block' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'on' : ''}
          aria-pressed={value === o.id}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Trash button for editor footers. */
export function DeleteButton({ onClick, label = t('common.delete') }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn danger flex-none" onClick={onClick} aria-label={label}>
      <Trash2 size={20} />
    </button>
  );
}
