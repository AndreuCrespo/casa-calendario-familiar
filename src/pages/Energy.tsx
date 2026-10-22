import { Zap } from 'lucide-react';
import { cheapestWindow, kwh, priceLevel, priceStats, usePvpc, type PvpcDay } from '../lib/pvpc';
import { PageHead, Spinner } from '../components/ui';

export default function Energy() {
  const { data, tomorrow, hour, error, loading } = usePvpc();

  if (!data) {
    return (
      <>
        <PageHead title="Luz" sub="Precio PVPC por horas" />
        <div className="center" style={{ padding: 40 }}>
          {loading ? <Spinner /> : <p className="error">{error ? 'No se pudieron cargar los precios de REE' : 'Precios aún no publicados'}</p>}
        </div>
      </>
    );
  }

  const s = priceStats(data);
  const cur = data.hours.find((h) => h.hour === hour) ?? data.hours[0];
  const lvl = priceLevel(cur.price, s);
  const w2 = cheapestWindow(data, 2, hour);
  const w3 = cheapestWindow(data, 3, hour);
  const fmtH = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <>
      <PageHead title="Luz" sub="Precio PVPC por horas · REE" />
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="label"><Zap size={14} /> Ahora ({fmtH(hour)})</div>
        <div className="row" style={{ marginTop: 8, alignItems: 'baseline' }}>
          <span className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em' }}>{cur.price.toFixed(3).replace('.', ',')}</span>
          <span className="muted bold">€/kWh</span>
          <div className="grow" />
          <span className={`pill ${lvl === 'low' ? 'green' : lvl === 'mid' ? 'amber' : 'red'}`}>
            {lvl === 'low' ? 'Barata' : lvl === 'mid' ? 'Normal' : 'Cara'}
          </span>
        </div>
        <div className="grid2" style={{ marginTop: 14 }}>
          <div><div className="tiny muted bold">MÍNIMO</div><div className="num bold">{kwh(s.min)}</div></div>
          <div><div className="tiny muted bold">MÁXIMO</div><div className="num bold">{kwh(s.max)}</div></div>
        </div>
      </section>

      {(w2 || w3) && (
        <section className="card" style={{ marginBottom: 12, background: 'var(--green-soft)', borderColor: 'transparent' }}>
          <div className="label" style={{ color: 'var(--green)' }}>Mejores horas que quedan hoy</div>
          <div className="stack" style={{ gap: 6, marginTop: 10 }}>
            {w2 && <div>🧺 Lavadora (2 h): <b>{fmtH(w2.start)}–{fmtH(w2.start + 2)}</b> <span className="muted num">· {kwh(w2.avg)}</span></div>}
            {w3 && <div>🍽️ Lavavajillas (3 h): <b>{fmtH(w3.start)}–{fmtH(w3.start + 3)}</b> <span className="muted num">· {kwh(w3.avg)}</span></div>}
          </div>
        </section>
      )}

      <div className="section-title">Hoy</div>
      <Bars day={data} hour={hour} />
      {tomorrow && (
        <>
          <div className="section-title">Mañana</div>
          <Bars day={tomorrow} hour={-1} />
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 12, textAlign: 'center' }}>
        Precio de la tarifa regulada (PVPC 2.0TD, península) publicado por Red Eléctrica. Si tienes tarifa de mercado libre, tu precio es otro.
      </p>
    </>
  );
}

function Bars({ day, hour }: { day: PvpcDay; hour: number }) {
  const s = priceStats(day);
  return (
    <div className="card">
      <div className="bars-chart">
        {day.hours.map((h, k) => (
          <div key={k} className={`b${h.hour === hour ? ' now' : ''}${hour >= 0 && h.hour < hour ? ' past' : ''}`} title={`${h.hour}:00 · ${kwh(h.price)}`}>
            <i className={`lvl-${priceLevel(h.price, s)}`} style={{ height: `${Math.max(6, (h.price / s.max) * 100)}%` }} />
            <span>{h.hour % 3 === 0 ? h.hour : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
