import { Zap } from 'lucide-react';
import { decimal, hm } from '../../core/format';
import { t } from '../../i18n';
import { PageHead, Spinner } from '../../ui/primitives';
import { cheapestWindow, hourLabel, kwh, type PriceLevel, type PvpcDay, priceLevel, priceStats, usePvpc } from './pvpc';
import './energy.css';

const LEVEL_PILL: Record<PriceLevel, string> = { low: 'green', mid: 'amber', high: 'red' };
const LEVEL_TEXT = { low: 'energy.cheap', mid: 'energy.normal', high: 'energy.expensive' } as const;

export default function EnergyPage() {
  const { data, current, tomorrow, error, loading, tz } = usePvpc();
  const cur = data?.hours[current] ?? data?.hours[0];

  if (!data || !cur) {
    return (
      <>
        <PageHead title={t('nav.energy')} sub={t('energy.subtitle')} />
        <div className="center pad-40">
          {loading ? <Spinner /> : <p className="error">{error ? t('energy.loadError') : t('energy.notPublished')}</p>}
        </div>
      </>
    );
  }

  const s = priceStats(data);
  const lvl = priceLevel(cur.price, s);
  const from = Math.max(0, current);
  const w2 = cheapestWindow(data, 2, from);
  const w3 = cheapestWindow(data, 3, from);
  const span = (start: number, hours: number) => `${hm(start)}–${hm((start + hours) % 24)}`;

  return (
    <>
      <PageHead title={t('nav.energy')} sub={`${t('energy.subtitle')} · REE`} />
      <section className="card mb-12">
        <div className="label">
          <Zap size={14} aria-hidden="true" /> {t('energy.nowAt', { time: hm(hourLabel(cur, tz)) })}
        </div>
        <div className="row baseline mt-8">
          <span className="num price-big">{decimal(cur.price, 3)}</span>
          <span className="muted bold">€/kWh</span>
          <div className="grow" />
          <span className={`pill ${LEVEL_PILL[lvl]}`}>{t(LEVEL_TEXT[lvl])}</span>
        </div>
        <div className="grid2 mt-14">
          <div>
            <div className="tiny muted bold upper">{t('energy.min')}</div>
            <div className="num bold">{kwh(s.min)}</div>
          </div>
          <div>
            <div className="tiny muted bold upper">{t('energy.max')}</div>
            <div className="num bold">{kwh(s.max)}</div>
          </div>
        </div>
      </section>

      {(w2 || w3) && (
        <section className="card tinted-green mb-12">
          <div className="label label-green">{t('energy.bestHours')}</div>
          <div className="stack gap-6 mt-10">
            {w2 && (
              <div>
                🧺 {t('energy.washer')}: <b>{span(hourLabel(w2.start, tz), 2)}</b>{' '}
                <span className="muted num">· {kwh(w2.avg)}</span>
              </div>
            )}
            {w3 && (
              <div>
                🍽️ {t('energy.dishwasher')}: <b>{span(hourLabel(w3.start, tz), 3)}</b>{' '}
                <span className="muted num">· {kwh(w3.avg)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      <h2 className="section-title">{t('date.today')}</h2>
      <PriceBars day={data} current={current} tz={tz} />
      {tomorrow && (
        <>
          <h2 className="section-title">{t('date.tomorrow')}</h2>
          <PriceBars day={tomorrow} current={-1} tz={tz} />
        </>
      )}
      <p className="tiny muted mt-12 text-center">{t('energy.disclaimer')}</p>
    </>
  );
}

function PriceBars({ day, current, tz }: { day: PvpcDay; current: number; tz: string }) {
  const s = priceStats(day);
  return (
    <div className="card">
      <div className="bars-chart" role="img" aria-label={t('energy.chartLabel', { min: kwh(s.min), max: kwh(s.max) })}>
        {day.hours.map((h, i) => {
          const hour = hourLabel(h, tz);
          const cls = `b${i === current ? ' now' : ''}${current >= 0 && i < current ? ' past' : ''}`;
          return (
            <div key={h.start} className={cls} title={`${hm(hour)} · ${kwh(h.price)}`}>
              <i
                className={`lvl-${priceLevel(h.price, s)}`}
                style={{ height: `${Math.max(6, (h.price / s.max) * 100)}%` }}
              />
              <span aria-hidden="true">{hour % 3 === 0 ? hour : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
