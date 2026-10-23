import { useMemo, useState } from 'react';
import { Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useApp, useCollection } from '../lib/app';
import type { ShoppingItem } from '../shared/types';
import { CheckCircle, Empty, PageHead, toast } from '../components/ui';
import { t, tn } from '../i18n';

interface ShoppingMeta { id: string; freq?: Record<string, number> }

const norm = (s: string) => s.trim().toLowerCase();

export default function Shopping() {
  const { backend, me, members, log } = useApp();
  const items = useCollection<ShoppingItem>('shopping');
  const meta = useCollection<ShoppingMeta>('meta');
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);

  const pending = useMemo(() => (items ?? []).filter((i) => !i.done).sort((a, b) => b.createdAt - a.createdAt), [items]);
  const done = useMemo(() => (items ?? []).filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)), [items]);
  const freq = meta?.find((m) => m.id === 'shopping')?.freq ?? {};

  const suggestions = useMemo(() => {
    const inList = new Set(pending.map((i) => norm(i.name)));
    return Object.entries(freq)
      .filter(([k]) => !inList.has(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  }, [freq, pending]);

  const add = (raw: string) => {
    // Several items can be added at once, comma-separated: "milk, bread, eggs"
    const names = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const existing = new Map((items ?? []).map((i) => [norm(i.name), i]));
    const added: string[] = [];
    for (const name of names) {
      const ex = existing.get(norm(name));
      if (ex && !ex.done) continue;
      if (ex) backend.update('shopping', ex.id, { done: false, doneAt: null, createdAt: Date.now(), addedBy: me?.id });
      else backend.add('shopping', { name: name.charAt(0).toUpperCase() + name.slice(1), done: false, addedBy: me?.id, createdAt: Date.now() });
      added.push(name);
    }
    if (added.length) {
      backend.set('meta', 'shopping', {
        freq: Object.fromEntries(added.map((n) => [norm(n), (freq[norm(n)] ?? 0) + 1])),
      }, true);
      added.forEach((n) => log('shopping', n.toLowerCase()));
    }
    setText('');
  };

  const toggle = (i: ShoppingItem) => backend.update('shopping', i.id, { done: !i.done, doneAt: i.done ? null : Date.now() });

  const clearDone = () => {
    const ids = done.map((i) => i.id);
    ids.forEach((id) => backend.remove('shopping', id));
    toast(tn('shopping.cleared', ids.length));
  };

  return (
    <>
      <PageHead title={t('nav.shopping')} sub={pending.length ? tn('shopping.toBuy', pending.length) : t('shopping.allBought')} />

      <form className="add-bar" onSubmit={(e) => { e.preventDefault(); add(text); }}>
        <input
          className="input grow"
          placeholder={t('shopping.addPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
        <button className="btn accent" style={{ width: 50, padding: 0 }} aria-label={t('common.add')}><Plus size={22} /></button>
      </form>

      {suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((s) => (
            <button key={s} className="chip sm" onClick={() => add(s)}><Plus size={14} />{s}</button>
          ))}
        </div>
      )}

      {items && pending.length === 0 && (
        <Empty icon={ShoppingCart} title={t('shopping.emptyTitle')}>{t('shopping.emptyText')}</Empty>
      )}

      {pending.length > 0 && (
        <div className="list">
          {pending.map((i) => {
            const by = members.find((m) => m.id === i.addedBy);
            return (
              <div key={i.id} className="list-item">
                <CheckCircle on={false} onClick={() => toggle(i)} />
                <div className="grow item-title" onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>{i.name}</div>
                {by && <span className="dot" style={{ background: by.color }} title={t('shopping.addedBy', { name: by.name })} />}
                <button className="icon-btn sm" onClick={() => backend.remove('shopping', i.id)} aria-label={t('common.remove')}><X size={17} /></button>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="section-title">
            <button onClick={() => setShowDone(!showDone)} style={{ font: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}>
              {showDone ? '▾' : '▸'} {t('shopping.inCart', { n: done.length })}
            </button>
            <div className="grow" />
            <button className="btn ghost sm" onClick={clearDone}><Trash2 size={15} /> {t('shopping.clear')}</button>
          </div>
          {showDone && (
            <div className="list">
              {done.map((i) => (
                <div key={i.id} className="list-item done">
                  <CheckCircle on onClick={() => toggle(i)} />
                  <div className="grow item-title" onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>{i.name}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
