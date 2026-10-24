import { type MessageKey, t } from '../../i18n';
import type { Note } from '../../shared/types';

export const NOTE_COLORS: readonly { color: string; label: MessageKey }[] = [
  { color: '#FFFCF7', label: 'color.white' },
  { color: '#FDE9A9', label: 'color.yellow' },
  { color: '#FAD4C8', label: 'color.peach' },
  { color: '#D7EEFB', label: 'color.lightBlue' },
  { color: '#D9F2DF', label: 'color.mint' },
  { color: '#E5DEFA', label: 'color.lilac' },
  { color: '#F6D9EC', label: 'color.rose' },
];

export const DEFAULT_NOTE_COLOR = '#FDE9A9';

/** Pinned first, then the most recently edited. */
export const sortNotes = (notes: readonly Note[]) =>
  [...notes].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt));

/** Short accessible name: the title, or the start of the text. */
export function noteLabel(n: Pick<Note, 'title' | 'body' | 'pinned'>) {
  const text = n.title || n.body.split('\n')[0]?.slice(0, 60) || t('notes.note');
  return n.pinned ? `${text} (${t('notes.pinned')})` : text;
}
