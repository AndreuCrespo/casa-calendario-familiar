// Previsión de Open-Meteo (gratis, sin clave).
import { useApp } from './app';
import { useRemote } from './remote';

export interface Weather {
  current: { temp: number; code: number; wind: number; humidity: number; isDay: boolean };
  hourly: { time: string[]; temp: number[]; code: number[]; pop: number[]; isDay: number[] };
  daily: { date: string[]; code: number[]; max: number[]; min: number[]; pop: number[]; rain: number[]; wind: number[]; sunrise: string[]; sunset: string[] };
}

export async function fetchWeather(lat: number, lon: number, tz: string): Promise<Weather> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    forecast_days: '8',
    current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  return {
    current: {
      temp: j.current.temperature_2m,
      code: j.current.weather_code,
      wind: j.current.wind_speed_10m,
      humidity: j.current.relative_humidity_2m,
      isDay: j.current.is_day === 1,
    },
    hourly: {
      time: j.hourly.time,
      temp: j.hourly.temperature_2m,
      code: j.hourly.weather_code,
      pop: j.hourly.precipitation_probability,
      isDay: j.hourly.is_day,
    },
    daily: {
      date: j.daily.time,
      code: j.daily.weather_code,
      max: j.daily.temperature_2m_max,
      min: j.daily.temperature_2m_min,
      pop: j.daily.precipitation_probability_max,
      rain: j.daily.precipitation_sum,
      wind: j.daily.wind_speed_10m_max,
      sunrise: j.daily.sunrise,
      sunset: j.daily.sunset,
    },
  };
}

export function useWeather() {
  const { household, tz } = useApp();
  const loc = household.location;
  const key = loc ? `weather:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : null;
  return useRemote(key, () => fetchWeather(loc!.lat, loc!.lon, tz), 30 * 60_000);
}

export interface GeoResult { name: string; admin1?: string; country?: string; lat: number; lon: number }

export async function searchPlaces(name: string): Promise<GeoResult[]> {
  const q = new URLSearchParams({ name, count: '6', language: 'es', format: 'json' });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  const j = await r.json();
  return (j.results ?? []).map((x: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
    name: x.name, admin1: x.admin1, country: x.country, lat: x.latitude, lon: x.longitude,
  }));
}

/** Descripción en castellano de los códigos WMO. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Despejado';
  if (code === 1) return 'Casi despejado';
  if (code === 2) return 'Parcialmente nuboso';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Niebla';
  if (code >= 51 && code <= 57) return 'Llovizna';
  if (code >= 61 && code <= 67) return 'Lluvia';
  if (code >= 71 && code <= 77) return 'Nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code === 85 || code === 86) return 'Chubascos de nieve';
  if (code >= 95) return 'Tormenta';
  return '—';
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'storm';
}

/** Índice de la previsión diaria para una fecha, o -1. */
export function dayIndex(w: Weather | undefined, date: string) {
  return w ? w.daily.date.indexOf(date) : -1;
}
