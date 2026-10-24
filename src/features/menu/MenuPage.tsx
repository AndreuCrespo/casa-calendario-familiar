import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useToday } from '../../core/app';
import { dateRange, dayLong, dow } from '../../core/format';
import { t } from '../../i18n';
import { addDays, type DateStr, parts, startOfWeek } from '../../shared/dates';
import { LIMITS } from '../../shared/limits';
import { PageHead } from '../../ui/primitives';
import { toast } from '../../ui/Toast';
import { dishSuggestions, useMenu } from './menu';
import './menu.css';

type Meal = 'lunch' | 'dinner';
const MEALS: readonly Meal[] = ['lunch', 'dinner'];

export default function MenuPage() {
  const { backend, log } = useApp();
  const today = useToday();
  const [week, setWeek] = useState(() => startOfWeek(today));
  const end = addDays(week, 6);
  const synced = useMenu();
  const shown = useMenu(addDays(week, -7), end);
  const byId = useMemo(() => new Map((shown ?? []).map((m) => [m.id, m])), [shown]);
  const dishes = useMemo(() => dishSuggestions(synced), [synced]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const save = (date: DateStr, meal: Meal, value: string) => {
    const v = value.trim();
    if (v === (byId.get(date)?.[meal] ?? '')) return;
    backend.merge('menu', date, { [meal]: v });
    if (v) log('menu', v);
  };

  const copyPrev = () => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const src = byId.get(addDays(week, i - 7));
      if (src && (src.lunch || src.dinner)) {
        backend.merge('menu', addDays(week, i), { lunch: src.lunch ?? '', dinner: src.dinner ?? '' });
        n++;
      }
    }
    toast(n ? t('menu.copied') : t('menu.prevEmpty'));
  };

  // Enter moves to the next field, like a form.
  const focusNext = (from: HTMLInputElement) => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.menu-inputs input')];
    const next = inputs[inputs.indexOf(from) + 1];
    if (next) next.focus();
    else from.blur();
  };

  return (
    <>
      <PageHead title={t('nav.menu')} sub={dateRange(week, end)}>
        <button
          type="button"
          className="icon-btn solid"
          onClick={() => setWeek(addDays(week, -7))}
          aria-label={t('menu.prevWeek')}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="icon-btn solid"
          onClick={() => setWeek(addDays(week, 7))}
          aria-label={t('menu.nextWeek')}
        >
          <ChevronRight size={20} />
        </button>
      </PageHead>

      <datalist id="dishes">
        {dishes.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <ul className="list">
        {days.map((d, i) => (
          <li key={d} className={`menu-day${d === today ? ' today' : ''}`}>
            <div className="cal-day-num" aria-hidden="true">
              <span className="d">{dow()[i]}</span>
              <span className="n num">{parts(d).d}</span>
            </div>
            <div className="menu-inputs">
              {MEALS.map((meal) => (
                <MealInput
                  key={meal}
                  label={meal === 'lunch' ? t('menu.lunch') : t('menu.dinner')}
                  dayLabel={dayLong(d)}
                  value={byId.get(d)?.[meal] ?? ''}
                  onSave={(v) => save(d, meal, v)}
                  onEnter={focusNext}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="row center-x mt-14">
        <button type="button" className="btn ghost sm" onClick={copyPrev}>
          <Copy size={15} aria-hidden="true" /> {t('menu.copyPrev')}
        </button>
      </div>
    </>
  );
}

/**
 * Field that saves on blur. Changes made by someone else show up unless the
 * field is being edited here, so nobody's typing is overwritten.
 */
function MealInput({
  label,
  dayLabel,
  value,
  onSave,
  onEnter,
}: {
  label: string;
  dayLabel: string;
  value: string;
  onSave: (v: string) => void;
  onEnter: (el: HTMLInputElement) => void;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);

  return (
    <label>
      <span>{label}</span>
      <input
        value={draft}
        list="dishes"
        placeholder="—"
        aria-label={`${label}, ${dayLabel}`}
        maxLength={LIMITS.dish}
        enterKeyHint="next"
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          editing.current = false;
          onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter(e.currentTarget);
          }
        }}
      />
    </label>
  );
}
