import { ChevronDown, ChevronRight, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useApp, useCollection, useDoc } from '../../core/app';
import { t, tn } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { ShoppingItem } from '../../shared/types';
import { CheckCircle, Empty, PageHead } from '../../ui/primitives';
import { toast } from '../../ui/Toast';
import { capitalize, nextFreq, normalizeItem, splitItems, suggestions } from './shopping';
import './shopping.css';

const NO_FREQ: Readonly<Record<string, number>> = {};

export default function ShoppingPage() {
  const { backend, me, membersById, log } = useApp();
  const items = useCollection('shopping');
  const meta = useDoc('meta', 'shopping');
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const doneId = useId();

  const pending = useMemo(
    () => (items ?? []).filter((i) => !i.done).sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );
  const done = useMemo(
    () => (items ?? []).filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    [items],
  );
  const freq = meta?.freq ?? NO_FREQ;
  const suggested = useMemo(() => suggestions(freq, pending), [freq, pending]);

  const add = (raw: string) => {
    const names = splitItems(raw);
    if (!names.length) return;
    const existing = new Map((items ?? []).map((i) => [normalizeItem(i.name), i]));
    const added: string[] = [];
    for (const name of names) {
      const ex = existing.get(normalizeItem(name));
      if (ex && !ex.done) continue;
      if (ex) backend.update('shopping', ex.id, { done: false, doneAt: null, createdAt: Date.now(), addedBy: me?.id });
      else backend.add('shopping', { name: capitalize(name), done: false, addedBy: me?.id, createdAt: Date.now() });
      added.push(name);
    }
    if (added.length) {
      const next = nextFreq(freq, added);
      if ('merge' in next) backend.merge('meta', 'shopping', { freq: next.merge });
      else backend.set('meta', 'shopping', { freq: next.replace });
      for (const n of added) log('shopping', n.toLowerCase());
    }
    setText('');
  };

  const toggle = (i: ShoppingItem) =>
    backend.update('shopping', i.id, { done: !i.done, doneAt: i.done ? null : Date.now() });

  const clearDone = () => {
    for (const i of done) backend.remove('shopping', i.id);
    toast(tn('shopping.cleared', done.length));
  };

  return (
    <>
      <PageHead
        title={t('nav.shopping')}
        sub={pending.length ? tn('shopping.toBuy', pending.length) : t('shopping.allBought')}
      />

      <form
        className="add-bar"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <input
          className="input grow"
          placeholder={t('shopping.addPlaceholder')}
          aria-label={t('shopping.addPlaceholder')}
          value={text}
          maxLength={LIMITS.shoppingItem * 10}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
        <button type="submit" className="btn accent square" aria-label={t('common.add')}>
          <Plus size={22} />
        </button>
      </form>

      {suggested.length > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own border and legend
        <div className="suggest" role="group" aria-label={t('shopping.suggestions')}>
          {suggested.map((s) => (
            <button key={s} type="button" className="chip sm" onClick={() => add(s)}>
              <Plus size={14} aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}

      {items && pending.length === 0 && (
        <Empty icon={ShoppingCart} title={t('shopping.emptyTitle')}>
          {t('shopping.emptyText')}
        </Empty>
      )}

      {pending.length > 0 && (
        <ul className="list">
          {pending.map((i) => {
            const by = i.addedBy ? membersById.get(i.addedBy) : undefined;
            return (
              <li key={i.id} className="list-item">
                <CheckCircle on={false} onClick={() => toggle(i)} label={i.name} />
                <button type="button" className="grow item-main item-title" onClick={() => toggle(i)}>
                  {i.name}
                </button>
                {by && (
                  <span
                    className="dot"
                    style={{ background: by.color }}
                    title={t('shopping.addedBy', { name: by.name })}
                    aria-label={t('shopping.addedBy', { name: by.name })}
                    role="img"
                  />
                )}
                <button
                  type="button"
                  className="icon-btn sm"
                  onClick={() => backend.remove('shopping', i.id)}
                  aria-label={t('common.removeItem', { item: i.name })}
                >
                  <X size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="section-title">
            <button
              type="button"
              className="disclosure"
              aria-expanded={showDone}
              aria-controls={doneId}
              onClick={() => setShowDone(!showDone)}
            >
              {showDone ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
              {t('shopping.inCart', { n: done.length })}
            </button>
            <div className="grow" />
            <button type="button" className="btn ghost sm" onClick={clearDone}>
              <Trash2 size={15} aria-hidden="true" /> {t('shopping.clear')}
            </button>
          </div>
          {showDone && (
            <ul className="list" id={doneId}>
              {done.map((i) => (
                <li key={i.id} className="list-item done">
                  <CheckCircle on onClick={() => toggle(i)} label={i.name} />
                  <button type="button" className="grow item-main item-title" onClick={() => toggle(i)}>
                    {i.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
