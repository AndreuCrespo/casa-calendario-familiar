import { useMemo, useState } from 'react';
import { Pin, PinOff, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useApp, useCollection } from '../lib/app';
import type { Note } from '../shared/types';
import { Empty, PageHead, Sheet } from '../components/ui';

const NOTE_COLORS = ['#FFFCF7', '#FDE9A9', '#FAD4C8', '#D7EEFB', '#D9F2DF', '#E5DEFA', '#F6D9EC'];

export default function Notes() {
  const { members } = useApp();
  const notes = useCollection<Note>('notes');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);

  const sorted = useMemo(() => [...(notes ?? [])].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt), [notes]);

  return (
    <>
      <PageHead title="Notas" sub="Tablón compartido" />
      {notes && notes.length === 0 && (
        <Empty icon={StickyNote} title="Sin notas">La wifi de invitados, teléfonos útiles, ideas de regalos…</Empty>
      )}
      <div className="notes">
        {sorted.map((n) => {
          const by = members.find((m) => m.id === n.updatedBy);
          return (
            <button key={n.id} className="note" style={{ '--nc': n.color } as React.CSSProperties} onClick={() => setEditing(n)}>
              {n.title && <h3>{n.pinned && <Pin size={14} style={{ marginTop: 3, flex: 'none' }} />}{n.title}</h3>}
              <p>{n.body}</p>
              {by && <div className="meta">{by.name}</div>}
            </button>
          );
        })}
      </div>
      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva nota"><Plus size={28} /></button>
      {editing && <NoteEditor note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const { backend, me, log } = useApp();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [color, setColor] = useState(note?.color ?? NOTE_COLORS[1]);
  const [pinned, setPinned] = useState(note?.pinned ?? false);

  const save = () => {
    if (!title.trim() && !body.trim()) { onClose(); return; }
    const data = { title: title.trim(), body: body.trim(), color, pinned, updatedAt: Date.now(), updatedBy: me?.id };
    if (note) backend.set('notes', note.id, data);
    else { backend.add('notes', data); log('note', data.title || data.body.slice(0, 40)); }
    onClose();
  };

  return (
    <Sheet
      title={note ? 'Nota' : 'Nueva nota'}
      onClose={save}
      footer={<>
        {note && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('notes', note.id); onClose(); }} aria-label="Borrar"><Trash2 size={20} /></button>}
        <button className="btn soft" style={{ flex: 'none' }} onClick={() => setPinned(!pinned)} aria-label={pinned ? 'Desfijar' : 'Fijar'}>
          {pinned ? <PinOff size={18} /> : <Pin size={18} />}
        </button>
        <button className="btn accent" onClick={save}>Guardar</button>
      </>}
    >
      <input className="input" style={{ fontSize: 18, fontWeight: 700, background: color, color: '#2a2620' }} placeholder="Título"
        value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!note} />
      <label className="field">
        <textarea style={{ minHeight: 180, background: color, color: '#2a2620' }} placeholder="Escribe aquí…" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="swatches">
        {NOTE_COLORS.map((c) => (
          <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ '--sc': c } as React.CSSProperties} onClick={() => setColor(c)} aria-label="Color" />
        ))}
      </div>
    </Sheet>
  );
}
