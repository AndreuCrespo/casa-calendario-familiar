import { Droplets, MapPin, Sunrise, Sunset, Wind } from 'lucide-react';
import { href } from '../../app/router';
import { useApp } from '../../core/app';
import { useNow } from '../../core/clock';
import { dow, hm } from '../../core/format';
import { t } from '../../i18n';
import { weekday, zonedParts } from '../../shared/dates';
import { PageHead, Spinner } from '../../ui/primitives';
import { WeatherIcon } from './WeatherIcon';
import { dayWeather, useWeather, type Weather, weatherLabel } from './weather';
import './weather.css';

export default function WeatherPage() {
  const { household } = useApp();
  const w = useWeather();

  if (!household.location) {
    return (
      <>
        <PageHead title={t('nav.weather')} />
        <div className="card">
          <p>
            {t('weather.pickCity1')}{' '}
            <a className="link" href={href('settings')}>
              {t('nav.settings')}
            </a>{' '}
            {t('weather.pickCity2')}
          </p>
        </div>
      </>
    );
  }
  if (!w.data) {
    return (
      <>
        <PageHead title={t('nav.weather')} sub={household.location.name} />
        <div className="center pad-40">{w.error ? <p className="error">{t('weather.loadError')}</p> : <Spinner />}</div>
      </>
    );
  }
  const d = w.data;
  return (
    <>
      <PageHead
        title={t('nav.weather')}
        sub={
          <span className="row gap-4">
            <MapPin size={13} aria-hidden="true" />
            {household.location.name}
          </span>
        }
      />
      <Current w={d} />
      <h2 className="section-title">{t('weather.next24')}</h2>
      <HourlyChart w={d} />
      <h2 className="section-title">{t('weather.nextDays')}</h2>
      <ul className="list">
        {d.daily.date.map((date, i) => {
          const day = dayWeather(d, date);
          if (!day) return null;
          return (
            <li key={date} className="list-item">
              <span className="wx-day bold">{i === 0 ? t('date.today') : dow()[weekday(date)]}</span>
              <WeatherIcon code={day.code} size={24} />
              <span className="grow small muted">{weatherLabel(day.code)}</span>
              <span className="wx-pop tiny num">{day.pop ? `${day.pop}%` : ''}</span>
              <span className="wx-temps num bold">
                {Math.round(day.max)}° <span className="muted">{Math.round(day.min)}°</span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Current({ w }: { w: Weather }) {
  const today = dayWeather(w, w.daily.date[0] ?? '');
  return (
    <section className="hero wx-hero">
      <div className="row gap-16">
        <WeatherIcon code={w.current.code} isDay={w.current.isDay} size={64} />
        <div className="grow">
          <div className="hero-clock num">{Math.round(w.current.temp)}°</div>
          <div className="hero-date">
            {weatherLabel(w.current.code)}
            {today &&
              ` · ${t('weather.max')} ${Math.round(today.max)}° · ${t('weather.min')} ${Math.round(today.min)}°`}
          </div>
        </div>
      </div>
      {today && (
        <div className="hero-days cols-4">
          <div className="hero-day">
            <Droplets size={18} aria-hidden="true" />
            <span>{today.pop}%</span>
            <span className="mn">{t('weather.rain')}</span>
          </div>
          <div className="hero-day">
            <Wind size={18} aria-hidden="true" />
            <span>{Math.round(w.current.wind)} km/h</span>
            <span className="mn">{t('weather.wind')}</span>
          </div>
          <div className="hero-day">
            <Sunrise size={18} aria-hidden="true" />
            <span>{today.sunrise.slice(11, 16)}</span>
            <span className="mn">{t('weather.sunrise')}</span>
          </div>
          <div className="hero-day">
            <Sunset size={18} aria-hidden="true" />
            <span>{today.sunset.slice(11, 16)}</span>
            <span className="mn">{t('weather.sunset')}</span>
          </div>
        </div>
      )}
    </section>
  );
}

const STEP = 46;
const HEIGHT = 170;
const TOP = 46;
const BOTTOM = 120;

function HourlyChart({ w }: { w: Weather }) {
  const { tz } = useApp();
  const now = useNow();
  const p = zonedParts(now, tz);
  const nowKey = `${p.date}T${hm(p.hour)}`;
  const start = Math.max(0, w.hourly.time.indexOf(nowKey));
  const hours = w.hourly.time.slice(start, start + 25).map((time, k) => ({
    time,
    temp: w.hourly.temp[start + k] ?? 0,
    code: w.hourly.code[start + k] ?? 0,
    pop: w.hourly.pop[start + k] ?? 0,
    isDay: w.hourly.isDay[start + k] === 1,
  }));
  if (hours.length < 2) return null;

  const temps = hours.map((h) => h.temp);
  const min = Math.min(...temps) - 1;
  const max = Math.max(...temps) + 1;
  const width = STEP * (hours.length - 1) + 40;
  const x = (k: number) => 20 + k * STEP;
  const y = (v: number) => BOTTOM - ((v - min) / (max - min || 1)) * (BOTTOM - TOP);
  const pts = temps.map((v, k) => [x(k), y(v)] as const);
  const path = pts
    .map(([px, py], k) => {
      const prev = pts[k - 1];
      if (!prev) return `M${px},${py}`;
      const cx = (prev[0] + px) / 2;
      return `C${cx},${prev[1]} ${cx},${py} ${px},${py}`;
    })
    .join(' ');
  const area = `${path} L${x(hours.length - 1)},${BOTTOM + 8} L${x(0)},${BOTTOM + 8} Z`;

  return (
    <div className="card chart-card">
      <div className="chart-wrap">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-labelledby="wx-chart-title"
        >
          <title id="wx-chart-title">{t('weather.hourlyChart')}</title>
          <defs>
            <linearGradient id="wx-temp-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="wx-fill-top" />
              <stop offset="1" className="wx-fill-bottom" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#wx-temp-fill)" />
          <path d={path} className="wx-line" />
          {hours.map((h, k) => (
            <g key={h.time}>
              <foreignObject x={x(k) - 10} y={6} width={20} height={20}>
                <WeatherIcon code={h.code} isDay={h.isDay} size={18} />
              </foreignObject>
              <circle cx={x(k)} cy={y(h.temp)} r="3" className="wx-dot" />
              <text x={x(k)} y={y(h.temp) - 9} className="wx-temp">
                {Math.round(h.temp)}°
              </text>
              {h.pop > 0 && (
                <text x={x(k)} y={BOTTOM + 24} className="wx-rain">
                  {h.pop}%
                </text>
              )}
              <text x={x(k)} y={HEIGHT - 6} className="wx-hour">
                {k === 0 ? t('next.now') : h.time.slice(11, 13)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
