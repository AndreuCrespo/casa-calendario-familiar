import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Sun,
} from 'lucide-react';
import { type WeatherKind, weatherKind, weatherLabel } from './weather';

const ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** Weather icon; decorative unless `labelled` (then it's read as the weather description). */
export function WeatherIcon({
  code,
  isDay = true,
  size = 20,
  labelled,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
  labelled?: boolean;
}) {
  const kind = weatherKind(code);
  const Icon = isDay ? ICONS[kind] : kind === 'clear' ? Moon : kind === 'partly' ? Cloud : ICONS[kind];
  const sunny = isDay && kind === 'clear';
  return (
    <Icon
      size={size}
      strokeWidth={1.8}
      className={sunny ? 'wx-sun' : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? weatherLabel(code) : undefined}
      role={labelled ? 'img' : undefined}
    />
  );
}
