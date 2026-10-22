import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { keyDateEmoji, keyDateLabel } from '../lib/agenda';
import { dayShort, euros, inDays, parseEuros } from '../lib/format';
import { diffDays } from '../shared/dates';
import { nextKeyDate } from '../shared/recurrence';
import type { KeyDate, KeyDateKind } from '../shared/types';
import { Empty, MemberPicker, PageHead, Sheet, toast } from '../components/ui';

const KINDS: { id: KeyDateKind; label: string }[] = [
  { id: 'birthday', label: 'Cumpleaños' },
  { id: 'car', label: 'Coche (ITV, revisión…)' },
  { id: 'insurance', label: 'Seguro' },
  { id: 'bill', label: 'Recibo / factura' },
  { id: 'health', label: 'Salud (vacunas, revisiones…)' },
  { id: 'school', label: 'Cole / guardería' },
  { id: 'other', label: 'Otro' },
];

export default function KeyDates() {
  const today = useToday();
  const dates = useCollection<KeyDate>('dates');
  const [editing, setEditing] = useState<KeyDate | 'new' | null>(null);

  const list = useMemo(() => (dates ?? [])
    .map((kd) => ({ kd, next: nextKeyDate(kd, today) }))
    .sort((a, b) => (a.next ?? '9999') < (b.next ?? '9999') ? -1 : 1), [dates, today]);

  const upcoming = list.filter((x) => x.next);
  const past = list.filter((x) => !x.next);

  const Row = ({ kd, next }: { kd: KeyDate; next: string | null }) => {
    const n = next ? diffDays(next, today) : null;
    const soon = n !== null && n <= kd.remindDays;
    return (
      <button className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setEditing(kd)}>
        <span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{keyDateEmoji(kd.kind)}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="item-title ellipsis">{next ? keyDateLabel(kd, next) : kd.title}</div>
          <div className="item-sub">
            {next ? dayShort(next) : `Pasó el ${dayShort(kd.date)}`}
            {kd.repeat === 'yearly' && ' · cada año'}
            {kd.repeat === 'monthly' && ' · cada mes'}
            {kd.amount ? ` · ${euros(kd.amount)}` : ''}
          </div>
        </div>
        {next && <span className={`pill${soon ? ' red' : ''}`}>{inDays(next, today)}</span>}
      </button>
    );
  };

  return (
    <>
      <PageHead title="Fechas" sub="Cumpleaños, vencimientos y recibos" />
      {dates && dates.length === 0 && (
        <Empty icon={CalendarClock} title="Sin fechas todavía">Apunta cumpleaños, la ITV, el seguro… y os avisará unos días antes.</Empty>
      )}
      {upcoming.length > 0 && <div className="list">{upcoming.map((x) => <Row key={x.kd.id} {...x} />)}</div>}
      {past.length > 0 && (
        <>
          <div className="section-title">Ya pasadas</div>
          <div className="list">{past.map((x) => <Row key={x.kd.id} {...x} />)}</div>
        </>
      )}
      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva fecha"><Plus size={28} /></button>
      {editing && <KeyDateEditor kd={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function KeyDateEditor({ kd, onClose }: { kd?: KeyDate; onClose: () => void }) {
  const { backend, members, log } = useApp();
  const today = useToday();
  const [title, setTitle] = useState(kd?.title ?? '');
  const [kind, setKind] = useState<KeyDateKind>(kd?.kind ?? 'other');
  const [date, setDate] = useState(kd?.date ?? today);
  const [repeat, setRepeat] = useState<KeyDate['repeat']>(kd?.repeat ?? 'none');
  const [remindDays, setRemindDays] = useState(kd?.remindDays ?? 7);
  const [amount, setAmount] = useState(kd?.amount ? (kd.amount / 100).toFixed(2).replace('.', ',') : '');
  const [memberIds, setMemberIds] = useState<string[]>(kd?.memberIds ?? []);
  const [notes, setNotes] = useState(kd?.notes ?? '');

  const onKind = (k: KeyDateKind) => {
    setKind(k);
    if (!kd) {
      if (k === 'birthday' || k === 'insurance') setRepeat('yearly');
      if (k === 'bill') { setRepeat('monthly'); setRemindDays(1); }
    }
  };

  const save = () => {
    if (!title.trim()) { toast('Ponle un nombre'); return; }
    const data = {
      title: title.trim(), kind, date, repeat, remindDays,
      amount: parseEuros(amount), memberIds, notes: notes.trim(),
    };
    if (kd) backend.set('dates', kd.id, data);
    else { backend.add('dates', data); log('date', data.title); }
    onClose();
  };

  return (
    <Sheet
      title={kd ? 'Editar fecha' : 'Nueva fecha'}
      onClose={onClose}
      footer={<>
        {kd && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('dates', kd.id); onClose(); }} aria-label="Borrar"><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>Guardar</button>
      </>}
    >
      <label className="field"><span>Tipo</span>
        <select value={kind} onChange={(e) => onKind(e.target.value as KeyDateKind)}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{keyDateEmoji(k.id)} {k.label}</option>)}
        </select>
      </label>
      <label className="field"><span>{kind === 'birthday' ? '¿De quién?' : 'Nombre'}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'birthday' ? 'Nombre' : 'Ej: ITV coche'} autoFocus={!kd} />
      </label>
      <div className="grid2">
        <label className="field"><span>{kind === 'birthday' ? 'Fecha de nacimiento' : 'Fecha'}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field"><span>Se repite</span>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as KeyDate['repeat'])}>
            <option value="none">No</option>
            <option value="monthly">Cada mes</option>
            <option value="yearly">Cada año</option>
          </select>
        </label>
      </div>
      <div className="grid2">
        <label className="field"><span>Avisar</span>
          <select value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))}>
            {[0, 1, 2, 3, 7, 15, 30, 60].map((n) => (
              <option key={n} value={n}>{n === 0 ? 'Ese mismo día' : n === 1 ? '1 día antes' : `${n} días antes`}</option>
            ))}
          </select>
        </label>
        {kind !== 'birthday' && (
          <label className="field"><span>Importe</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Opcional (€)" />
          </label>
        )}
      </div>
      <div className="field"><span>Relacionado con</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="field"><span>Notas</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nº de póliza, teléfono…" />
      </label>
    </Sheet>
  );
}
