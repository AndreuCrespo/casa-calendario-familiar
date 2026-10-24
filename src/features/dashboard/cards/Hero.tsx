import { Droplets } from 'lucide-react';
import { href } from '../../../app/router';
import { useApp, useTime, useToday } from '../../../core/app';
import { cap, dayMonth, dow, weekdayLong } from '../../../core/format';
import { t } from '../../../i18n';
import { addDays, weekday } from '../../../shared/dates';
import { WeatherIcon } from '../../weather/WeatherIcon';
import { dayWeather, type Weather, weatherLabel } from '../../weather/weather';

/** Clock, date and the weather for the next days. */
export function Hero({ weather }: { weather: Weather | undefined }) {
  const { household } = useApp();
  const time = useTime();
  const today = useToday();
  const now = dayWeather(weather, today);
  const next = [1, 2, 3, 4, 5].flatMap((n) => {
    const date = addDays(today, n);
    const w = dayWeather(weather, date);
    return w ? [{ date, ...w }] : [];
  });

  return (
    <section className="hero" aria-label={t('widget.hero')}>
      <div className="hero-top">
        <div>
          <div className="hero-clock num">{time}</div>
          <div className="hero-date">
            <b>{cap(weekdayLong(today))}</b> {dayMonth(today)}
          </div>
        </div>
        {weather && (
          <a className="hero-now" href={href('weather')}>
            <div className="row end gap-6">
              <WeatherIcon code={weather.current.code} isDay={weather.current.isDay} size={30} />
              <span className="t num">{Math.round(weather.current.temp)}°</span>
            </div>
            <div className="s">{weatherLabel(weather.current.code)}</div>
            {now && (
              <div className="s num">
                {Math.round(now.min)}° / {Math.round(now.max)}° ·{' '}
                <Droplets size={11} className="inline-icon" aria-hidden="true" /> {now.pop}%
              </div>
            )}
          </a>
        )}
        {!weather && !household.location && (
          <a className="hero-now s pick-city" href={href('settings')}>
            {t('hero.pickCity')}
          </a>
        )}
      </div>
      {next.length > 0 && (
        <a className="hero-days" href={href('weather')} aria-label={t('weather.nextDays')}>
          {next.map((d) => (
            <div className="hero-day num" key={d.date}>
              <span>{dow()[weekday(d.date)]}</span>
              <WeatherIcon code={d.code} size={20} labelled />
              <span className="mx">{Math.round(d.max)}°</span>
              <span className="mn">{Math.round(d.min)}°</span>
              <span className="pp">{d.pop}%</span>
            </div>
          ))}
        </a>
      )}
    </section>
  );
}
