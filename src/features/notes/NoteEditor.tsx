import { Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../core/app';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { Note } from '../../shared/types';
import { DeleteButton } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { ColorSwatches } from '../members/members';
import { DEFAULT_NOTE_COLOR, NOTE_COLORS } from './notes';

/**
 * Notes save when closed (✕, Back, tapping outside), like paper notes. Closing
 * without changes writes nothing, and emptying a note deletes it (with Undo).
 */
export function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const { backend, me, log } = useApp();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [color, setColor] = useState(note?.color ?? DEFAULT_NOTE_COLOR);
  const [pinned, setPinned] = useState(note?.pinned ?? false);

  const remove = (n: Note) => {
    backend.remove('notes', n.id);
    const { id, ...data } = n;
    toast(t('notes.deleted'), { label: t('common.undo'), run: () => backend.set('notes', id, data) });
  };

  const close = () => {
    const data = { title: title.trim(), body: body.trim(), color, pinned };
    const empty = !data.title && !data.body;
    if (!note) {
      if (!empty) {
        backend.add('notes', { ...data, updatedAt: Date.now(), updatedBy: me?.id });
        log('note', data.title || data.body.slice(0, 40));
      }
    } else if (empty) {
      remove(note);
    } else if (
      data.title !== note.title ||
      data.body !== note.body ||
      data.color !== note.color ||
      data.pinned !== note.pinned
    ) {
      backend.set('notes', note.id, { ...data, updatedAt: Date.now(), updatedBy: me?.id });
    }
    onClose();
  };

  return (
    <Sheet
      title={note ? t('notes.note') : t('notes.new')}
      onClose={close}
      footer={
        <>
          {note && (
            <DeleteButton
              onClick={() => {
                remove(note);
                onClose();
              }}
            />
          )}
          <button
            type="button"
            className="btn soft flex-none"
            onClick={() => setPinned(!pinned)}
            aria-pressed={pinned}
            aria-label={pinned ? t('notes.unpin') : t('notes.pin')}
          >
            {pinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
          <button type="button" className="btn accent" onClick={close}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <input
        className="input title-input note-paper"
        style={{ '--nc': color }}
        placeholder={t('notes.titlePlaceholder')}
        aria-label={t('notes.titlePlaceholder')}
        value={title}
        maxLength={LIMITS.title}
        onChange={(e) => setTitle(e.target.value)}
        // biome-ignore lint/a11y/noAutofocus: the sheet was opened to write a new note
        autoFocus={!note}
      />
      <textarea
        className="input note-paper note-text"
        style={{ '--nc': color }}
        placeholder={t('notes.bodyPlaceholder')}
        aria-label={t('notes.bodyPlaceholder')}
        value={body}
        maxLength={LIMITS.noteBody}
        onChange={(e) => setBody(e.target.value)}
      />
      <ColorSwatches colors={NOTE_COLORS} value={color} onChange={setColor} />
    </Sheet>
  );
}
