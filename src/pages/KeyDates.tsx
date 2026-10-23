import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { keyDateEmoji, keyDateLabel } from '../lib/agenda';
import { centsToInput, dayShort, euros, inDays, parseEuros } from '../lib/format';
import { diffDays } from '../shared/dates';
import { nextKeyDate } from '../shared/recurrence';
import type { KeyDate, KeyDateKind } from '../shared/types';
import { Empty, MemberPicker, PageHead, Sheet, toast } from '../components/ui';
import { t, tn, type MessageKey } from '../i18n';

const KINDS: { id: KeyDateKind; label: MessageKey }[] = [
  { id: 'birthday', label: 'kind.birthday' },
  { id: 'car', label: 'kind.car' },
  { id: 'insurance', label: 'kind.insurance' },
  { id: 'bill', label: 'kind.bill' },
  { id: 'health', label: 'kind.health' },
  { id: 'school', label: 'kind.school' },
  { id: 'other', label: 'kind.other' },
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
            {next ? dayShort(next) : t('dates.passedOn', { day: dayShort(kd.date) })}
            {kd.repeat === 'yearly' && ` · ${t('dates.everyYear')}`}
            {kd.repeat === 'monthly' && ` · ${t('dates.everyMonth')}`}
            {kd.amount ? ` · ${euros(kd.amount)}` : ''}
          </div>
        </div>
        {next && <span className={`pill${soon ? ' red' : ''}`}>{inDays(next, today)}</span>}
      </button>
    );
  };

  return (
    <>
      <PageHead title={t('nav.dates')} sub={t('dates.subtitle')} />
      {dates && dates.length === 0 && (
        <Empty icon={CalendarClock} title={t('dates.emptyTitle')}>{t('dates.emptyText')}</Empty>
      )}
      {upcoming.length > 0 && <div className="list">{upcoming.map((x) => <Row key={x.kd.id} {...x} />)}</div>}
      {past.length > 0 && (
        <>
          <div className="section-title">{t('dates.past')}</div>
          <div className="list">{past.map((x) => <Row key={x.kd.id} {...x} />)}</div>
        </>
      )}
      <button className="fab" onClick={() => setEditing('new')} aria-label={t('dates.new')}><Plus size={28} /></button>
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
  const [amount, setAmount] = useState(kd?.amount ? centsToInput(kd.amount) : '');
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
    if (!title.trim()) { toast(t('dates.needName')); return; }
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
      title={kd ? t('dates.edit') : t('dates.new')}
      onClose={onClose}
      footer={<>
        {kd && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('dates', kd.id); onClose(); }} aria-label={t('common.delete')}><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>{t('common.save')}</button>
      </>}
    >
      <label className="field"><span>{t('dates.type')}</span>
        <select value={kind} onChange={(e) => onKind(e.target.value as KeyDateKind)}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{keyDateEmoji(k.id)} {t(k.label)}</option>)}
        </select>
      </label>
      <label className="field"><span>{kind === 'birthday' ? t('dates.whose') : t('dates.name')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'birthday' ? t('dates.name') : t('dates.namePlaceholder')} autoFocus={!kd} />
      </label>
      <div className="grid2">
        <label className="field"><span>{kind === 'birthday' ? t('dates.birthDate') : t('dates.date')}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field"><span>{t('dates.repeats')}</span>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as KeyDate['repeat'])}>
            <option value="none">{t('common.no')}</option>
            <option value="monthly">{t('repeat.monthly')}</option>
            <option value="yearly">{t('repeat.yearly')}</option>
          </select>
        </label>
      </div>
      <div className="grid2">
        <label className="field"><span>{t('dates.remind')}</span>
          <select value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))}>
            {[0, 1, 2, 3, 7, 15, 30, 60].map((n) => (
              <option key={n} value={n}>{n === 0 ? t('dates.sameDay') : tn('dates.daysBefore', n)}</option>
            ))}
          </select>
        </label>
        {kind !== 'birthday' && (
          <label className="field"><span>{t('dates.amount')}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('dates.amountPlaceholder')} />
          </label>
        )}
      </div>
      <div className="field"><span>{t('dates.relatedTo')}</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="field"><span>{t('common.notes')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('dates.notesPlaceholder')} />
      </label>
    </Sheet>
  );
}
