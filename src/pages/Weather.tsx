import { Droplets, MapPin, Sunrise, Sunset, Wind } from 'lucide-react';
import { useApp, useNow } from '../lib/app';
import { dow } from '../lib/format';
import { t } from '../i18n';
import { href } from '../lib/router';
import { useWeather, weatherLabel, type Weather } from '../lib/weather';
import { weekday, zonedParts } from '../shared/dates';
import { PageHead, Spinner, WeatherIcon } from '../components/ui';

export default function WeatherPage() {
  const { household } = useApp();
  const w = useWeather();

  if (!household.location) {
    return (
      <>
        <PageHead title={t('nav.weather')} />
        <div className="card">
          <p>{t('weather.pickCity1')} <a href={href('settings')} style={{ color: 'var(--accent)', fontWeight: 700 }}>{t('nav.settings')}</a> {t('weather.pickCity2')}</p>
        </div>
      </>
    );
  }
  if (!w.data) {
    return (
      <>
        <PageHead title={t('nav.weather')} sub={household.location.name} />
        <div className="center" style={{ padding: 40 }}>{w.error ? <p className="error">{t('weather.loadError')}</p> : <Spinner />}</div>
      </>
    );
  }
  const d = w.data;
  return (
    <>
      <PageHead title={t('nav.weather')} sub={<span className="row" style={{ gap: 4 }}><MapPin size={13} />{household.location.name}</span>} />
      <Current w={d} />
      <div className="section-title">{t('weather.next24')}</div>
      <HourlyChart w={d} />
      <div className="section-title">{t('weather.nextDays')}</div>
      <div className="list">
        {d.daily.date.map((date, i) => (
          <div key={date} className="list-item">
            <div style={{ width: 54 }} className="bold">{i === 0 ? t('date.today') : dow()[weekday(date)]}</div>
            <WeatherIcon code={d.daily.code[i]} size={24} />
            <div className="grow small muted">{weatherLabel(d.daily.code[i])}</div>
            <span className="tiny num" style={{ color: 'var(--blue)', fontWeight: 700, width: 42, textAlign: 'right' }}>
              {d.daily.pop[i] ? `${d.daily.pop[i]}%` : ''}
            </span>
            <span className="num bold" style={{ width: 70, textAlign: 'right' }}>
              {Math.round(d.daily.max[i])}° <span className="muted">{Math.round(d.daily.min[i])}°</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Current({ w }: { w: Weather }) {
  const di = 0;
  return (
    <section className="hero" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="row" style={{ gap: 16 }}>
        <WeatherIcon code={w.current.code} isDay={w.current.isDay} size={64} />
        <div className="grow">
          <div className="hero-clock num" style={{ fontSize: 64 }}>{Math.round(w.current.temp)}°</div>
          <div className="hero-date">{weatherLabel(w.current.code)} · {t('weather.max')} {Math.round(w.daily.max[di])}° · {t('weather.min')} {Math.round(w.daily.min[di])}°</div>
        </div>
      </div>
      <div className="hero-days" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="hero-day"><Droplets size={18} /><span>{w.daily.pop[di] ?? 0}%</span><span className="mn">{t('weather.rain')}</span></div>
        <div className="hero-day"><Wind size={18} /><span>{Math.round(w.current.wind)} km/h</span><span className="mn">{t('weather.wind')}</span></div>
        <div className="hero-day"><Sunrise size={18} /><span>{w.daily.sunrise[di]?.slice(11, 16)}</span><span className="mn">{t('weather.sunrise')}</span></div>
        <div className="hero-day"><Sunset size={18} /><span>{w.daily.sunset[di]?.slice(11, 16)}</span><span className="mn">{t('weather.sunset')}</span></div>
      </div>
    </section>
  );
}

function HourlyChart({ w }: { w: Weather }) {
  const { tz } = useApp();
  const now = useNow(60_000);
  const p = zonedParts(now, tz);
  const nowKey = `${p.date}T${String(p.hour).padStart(2, '0')}:00`;
  const start = Math.max(0, w.hourly.time.indexOf(nowKey));
  const idx = Array.from({ length: 25 }, (_, i) => start + i).filter((i) => i < w.hourly.time.length);
  const temps = idx.map((i) => w.hourly.temp[i]);
  const min = Math.min(...temps) - 1;
  const max = Math.max(...temps) + 1;
  const step = 46;
  const W = step * (idx.length - 1) + 40;
  const H = 170;
  const top = 46;
  const bottom = 120;
  const x = (k: number) => 20 + k * step;
  const y = (t: number) => bottom - ((t - min) / (max - min || 1)) * (bottom - top);
  const pts = temps.map((t, k) => [x(k), y(t)] as const);
  const path = pts.map(([px, py], k) => {
    if (k === 0) return `M${px},${py}`;
    const [qx, qy] = pts[k - 1];
    const cx = (qx + px) / 2;
    return `C${cx},${qy} ${cx},${py} ${px},${py}`;
  }).join(' ');
  const area = `${path} L${pts[pts.length - 1][0]},${bottom + 8} L${pts[0][0]},${bottom + 8} Z`;

  return (
    <div className="card" style={{ padding: '12px 0' }}>
      <div className="chart-wrap">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('weather.hourlyChart')}>
          <defs>
            <linearGradient id="tg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#F5B638" stopOpacity=".35" />
              <stop offset="1" stopColor="#F5B638" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#tg)" />
          <path d={path} fill="none" stroke="#E9A23B" strokeWidth="2.5" />
          {idx.map((i, k) => (
            <g key={i}>
              <foreignObject x={x(k) - 10} y={6} width={20} height={20}>
                <WeatherIcon code={w.hourly.code[i]} isDay={w.hourly.isDay[i] === 1} size={18} />
              </foreignObject>
              <circle cx={x(k)} cy={y(temps[k])} r="3" fill="#E9A23B" />
              <text x={x(k)} y={y(temps[k]) - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">{Math.round(temps[k])}°</text>
              {w.hourly.pop[i] > 0 && (
                <text x={x(k)} y={bottom + 24} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--blue)">{w.hourly.pop[i]}%</text>
              )}
              <text x={x(k)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">
                {k === 0 ? t('next.now') : w.hourly.time[i].slice(11, 13)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

