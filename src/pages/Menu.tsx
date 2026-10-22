import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { DOW, MONTHS_SHORT } from '../lib/format';
import { addDays, parts, startOfWeek, type DateStr } from '../shared/dates';
import type { MenuDay } from '../shared/types';
import { PageHead, toast } from '../components/ui';

export default function Menu() {
  const { backend, log } = useApp();
  const today = useToday();
  const menu = useCollection<MenuDay>('menu');
  const [week, setWeek] = useState(() => startOfWeek(today));
  const byId = useMemo(() => new Map((menu ?? []).map((m) => [m.id, m])), [menu]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const dishes = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of menu ?? []) for (const d of [m.lunch, m.dinner]) if (d) count.set(d, (count.get(d) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 200);
  }, [menu]);

  const save = (date: DateStr, field: 'lunch' | 'dinner', value: string) => {
    const cur = byId.get(date)?.[field] ?? '';
    if (value.trim() === cur) return;
    backend.set('menu', date, { [field]: value.trim() }, true);
    if (value.trim()) log('menu', value.trim());
  };

  const copyPrev = () => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const src = byId.get(addDays(week, i - 7));
      if (src && (src.lunch || src.dinner)) {
        backend.set('menu', addDays(week, i), { lunch: src.lunch ?? '', dinner: src.dinner ?? '' }, true);
        n++;
      }
    }
    toast(n ? 'Semana anterior copiada' : 'La semana anterior está vacía');
  };

  const end = addDays(week, 6);
  const sub = `${parts(week).d} ${MONTHS_SHORT[parts(week).m - 1]} – ${parts(end).d} ${MONTHS_SHORT[parts(end).m - 1]}`;

  return (
    <>
      <PageHead title="Menú" sub={sub}>
        <button className="icon-btn solid" onClick={() => setWeek(addDays(week, -7))} aria-label="Semana anterior"><ChevronLeft size={20} /></button>
        <button className="icon-btn solid" onClick={() => setWeek(addDays(week, 7))} aria-label="Semana siguiente"><ChevronRight size={20} /></button>
      </PageHead>

      <datalist id="dishes">{dishes.map((d) => <option key={d} value={d} />)}</datalist>

      <div className="list">
        {days.map((d, i) => {
          const m = byId.get(d);
          return (
            <div key={d} className={`menu-day${d === today ? ' today' : ''}`}>
              <div className="cal-day-num">
                <span className="d">{DOW[i]}</span>
                <span className="n num">{parts(d).d}</span>
              </div>
              <div className="menu-inputs">
                {(['lunch', 'dinner'] as const).map((f) => (
                  <label key={f}>
                    <span>{f === 'lunch' ? 'Comida' : 'Cena'}</span>
                    <input
                      key={`${d}-${f}-${m?.[f] ?? ''}`}
                      defaultValue={m?.[f] ?? ''}
                      list="dishes"
                      placeholder="—"
                      enterKeyHint="next"
                      onBlur={(e) => save(d, f, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
        <button className="btn ghost sm" onClick={copyPrev}><Copy size={15} /> Copiar la semana anterior</button>
      </div>
    </>
  );
}
