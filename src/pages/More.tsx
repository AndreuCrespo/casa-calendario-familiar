import type { CSSProperties } from 'react';
import { CalendarClock, CloudSun, Settings, StickyNote, UtensilsCrossed, Wallet, Zap, type LucideIcon } from 'lucide-react';
import { href, type Route } from '../lib/router';
import { PageHead } from '../components/ui';
import { InstallHint } from '../components/InstallHint';
import { t, type MessageKey } from '../i18n';

const TILES: { route: Route; label: MessageKey; sub: MessageKey; icon: LucideIcon; color: string }[] = [
  { route: 'menu', label: 'nav.menu', sub: 'more.menu.sub', icon: UtensilsCrossed, color: '#F08C2E' },
  { route: 'dates', label: 'nav.dates', sub: 'more.dates.sub', icon: CalendarClock, color: '#D9483B' },
  { route: 'expenses', label: 'nav.expenses', sub: 'more.expenses.sub', icon: Wallet, color: '#4C7DF0' },
  { route: 'notes', label: 'nav.notes', sub: 'more.notes.sub', icon: StickyNote, color: '#C99A1E' },
  { route: 'weather', label: 'nav.weather', sub: 'more.weather.sub', icon: CloudSun, color: '#14A3B8' },
  { route: 'energy', label: 'nav.energy', sub: 'more.energy.sub', icon: Zap, color: '#22A06B' },
];

export default function More() {
  return (
    <>
      <PageHead title={t('nav.more')} />
      <InstallHint />
      <div className="tiles">
        {TILES.map((tile) => (
          <a key={tile.route} className="tile card-link" href={href(tile.route)}>
            <span className="ic" style={{ '--tc': tile.color } as CSSProperties}><tile.icon size={22} /></span>
            <div><b>{t(tile.label)}</b><div className="sub">{t(tile.sub)}</div></div>
          </a>
        ))}
      </div>
      <a className="list-item card-link list" href={href('settings')} style={{ marginTop: 12 }}>
        <Settings size={20} className="muted" />
        <b className="grow">{t('nav.settings')}</b>
      </a>
    </>
  );
}
