import { Pin, StickyNote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCollection } from '../../core/app';
import { t } from '../../i18n';
import type { Note } from '../../shared/types';
import { Empty, Fab, PageHead } from '../../ui/primitives';
import { NoteEditor } from './NoteEditor';
import { noteLabel, sortNotes } from './notes';
import './notes.css';

export default function NotesPage() {
  const { membersById } = useApp();
  const notes = useCollection('notes');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const sorted = useMemo(() => sortNotes(notes ?? []), [notes]);

  return (
    <>
      <PageHead title={t('nav.notes')} sub={t('notes.subtitle')} />
      {notes && notes.length === 0 && (
        <Empty icon={StickyNote} title={t('notes.emptyTitle')}>
          {t('notes.emptyText')}
        </Empty>
      )}
      <ul className="notes">
        {sorted.map((n) => {
          const by = n.updatedBy ? membersById.get(n.updatedBy) : undefined;
          return (
            <li key={n.id}>
              <button
                type="button"
                className="note"
                style={{ '--nc': n.color }}
                onClick={() => setEditing(n)}
                aria-label={noteLabel(n)}
              >
                {n.title && (
                  <span className="note-title">
                    {n.pinned && <Pin size={14} aria-hidden="true" />}
                    {n.title}
                  </span>
                )}
                <span className="note-body">{n.body}</span>
                {by && <span className="note-meta">{by.name}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <Fab label={t('notes.new')} onClick={() => setEditing('new')} />
      {editing && <NoteEditor note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
