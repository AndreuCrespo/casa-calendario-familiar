// Precio de la luz PVPC por horas, de la API pública de Red Eléctrica (REE).
import { useApp, useNow } from './app';
import { useRemote } from './remote';
import { addDays, todayIn, zonedParts } from '../shared/dates';

export interface PvpcHour { hour: number; price: number } // €/kWh
export interface PvpcDay { date: string; hours: PvpcHour[] }

export async function fetchPvpc(date: string): Promise<PvpcDay | null> {
  const q = new URLSearchParams({
    start_date: `${date}T00:00`,
    end_date: `${date}T23:59`,
    time_trunc: 'hour',
  });
  const r = await fetch(`https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?${q}`);
  if (!r.ok) {
    if (r.status === 404 || r.status === 500) return null; // aún no publicado
    throw new Error(`REE ${r.status}`);
  }
  const j = await r.json();
  const serie = (j.included ?? []).find((x: { type: string }) => x.type === 'PVPC');
  if (!serie) return null;
  const hours: PvpcHour[] = serie.attributes.values
    .filter((v: { datetime: string }) => v.datetime.startsWith(date))
    .map((v: { value: number; datetime: string }) => ({
      hour: Number(v.datetime.slice(11, 13)),
      price: v.value / 1000,
    }));
  return hours.length ? { date, hours } : null;
}

export function usePvpc() {
  const { tz } = useApp();
  const now = useNow(60_000);
  const today = todayIn(tz, now);
  const hour = zonedParts(now, tz).hour;
  const todayData = useRemote(`pvpc:${today}`, () => fetchPvpc(today), 6 * 3600_000);
  // Los precios de mañana se publican sobre las 20:15
  const tomorrow = addDays(today, 1);
  const tomorrowData = useRemote(hour >= 20 ? `pvpc:${tomorrow}:v${hour}` : null, () => fetchPvpc(tomorrow), 3600_000);
  return { today, hour, data: todayData.data ?? null, loading: todayData.loading, error: todayData.error, tomorrow: tomorrowData.data ?? null };
}

export function priceStats(day: PvpcDay) {
  const ps = day.hours.map((h) => h.price);
  const sorted = [...ps].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p33 = sorted[Math.floor(sorted.length / 3)];
  const p66 = sorted[Math.floor((sorted.length * 2) / 3)];
  const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
  return { min, max, avg, p33, p66 };
}

export function priceLevel(price: number, s: { p33: number; p66: number }): 'low' | 'mid' | 'high' {
  return price <= s.p33 ? 'low' : price <= s.p66 ? 'mid' : 'high';
}

/** Ventana de `len` horas consecutivas más barata desde `fromHour`. */
export function cheapestWindow(day: PvpcDay, len: number, fromHour = 0) {
  const hs = day.hours.filter((h) => h.hour >= fromHour);
  let best: { start: number; avg: number } | null = null;
  for (let i = 0; i + len <= hs.length; i++) {
    const avg = hs.slice(i, i + len).reduce((a, h) => a + h.price, 0) / len;
    if (!best || avg < best.avg) best = { start: hs[i].hour, avg };
  }
  return best;
}

export const kwh = (p: number) => `${p.toFixed(3).replace('.', ',')} €/kWh`;
