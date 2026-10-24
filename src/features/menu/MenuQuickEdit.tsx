import { useMemo, useState } from 'react';
import { href } from '../../app/router';
import { useApp } from '../../core/app';
import { dayLong } from '../../core/format';
import { t } from '../../i18n';
import type { DateStr } from '../../shared/dates';
import { LIMITS } from '../../shared/limits';
import type { MenuDay } from '../../shared/types';
import { Sheet } from '../../ui/Sheet';
import { dishSuggestions, useMenu } from './menu';

/** Lunch and dinner of one day, from the home screen. */
export function MenuQuickEdit({ date, current, onClose }: { date: DateStr; current?: MenuDay; onClose: () => void }) {
  const { backend, log } = useApp();
  const synced = useMenu();
  const dishes = useMemo(() => dishSuggestions(synced, 100), [synced]);
  const [lunch, setLunch] = useState(current?.lunch ?? '');
  const [dinner, setDinner] = useState(current?.dinner ?? '');

  const save = () => {
    const l = lunch.trim();
    const d = dinner.trim();
    if (l !== (current?.lunch ?? '') || d !== (current?.dinner ?? '')) {
      backend.merge('menu', date, { lunch: l, dinner: d });
      log('menu', [l, d].filter(Boolean).join(' / '));
    }
    onClose();
  };

  return (
    <Sheet
      title={`${t('nav.menu')} · ${dayLong(date)}`}
      onClose={onClose}
      footer={
        <>
          {/* Closing first, so the sheet doesn't stay in the history. */}
          <a className="btn ghost flex-none" href={href('menu')} onClick={onClose}>
            {t('menu.seeWeek')}
          </a>
          <button type="button" className="btn accent" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <datalist id="dishes-quick">
        {dishes.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <label className="field">
        <span>{t('menu.lunch')}</span>
        <input
          value={lunch}
          maxLength={LIMITS.dish}
          onChange={(e) => setLunch(e.target.value)}
          list="dishes-quick"
          placeholder={t('menu.lunchPlaceholder')}
        />
      </label>
      <label className="field">
        <span>{t('menu.dinner')}</span>
        <input
          value={dinner}
          maxLength={LIMITS.dish}
          onChange={(e) => setDinner(e.target.value)}
          list="dishes-quick"
          placeholder={t('menu.dinnerPlaceholder')}
        />
      </label>
    </Sheet>
  );
}
