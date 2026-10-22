import { CalendarClock, CloudSun, Settings, StickyNote, UtensilsCrossed, Wallet, Zap, type LucideIcon } from 'lucide-react';
import { href, type Route } from '../lib/router';
import { PageHead } from '../components/ui';
import { InstallHint } from '../components/InstallHint';

const TILES: { route: Route; label: string; sub: string; icon: LucideIcon; color: string }[] = [
  { route: 'menu', label: 'Menú', sub: 'Comidas y cenas', icon: UtensilsCrossed, color: '#F08C2E' },
  { route: 'fechas', label: 'Fechas', sub: 'Cumples y vencimientos', icon: CalendarClock, color: '#D9483B' },
  { route: 'gastos', label: 'Gastos', sub: 'Quién debe a quién', icon: Wallet, color: '#4C7DF0' },
  { route: 'notas', label: 'Notas', sub: 'Tablón compartido', icon: StickyNote, color: '#C99A1E' },
  { route: 'tiempo', label: 'Tiempo', sub: 'Previsión', icon: CloudSun, color: '#14A3B8' },
  { route: 'luz', label: 'Luz', sub: 'Precio por horas', icon: Zap, color: '#22A06B' },
];

export default function More() {
  return (
    <>
      <PageHead title="Más" />
      <InstallHint />
      <div className="tiles">
        {TILES.map((t) => (
          <a key={t.route} className="tile card-link" href={href(t.route)}>
            <span className="ic" style={{ '--tc': t.color } as React.CSSProperties}><t.icon size={22} /></span>
            <div><b>{t.label}</b><div className="sub">{t.sub}</div></div>
          </a>
        ))}
      </div>
      <a className="list-item card-link list" href={href('ajustes')} style={{ marginTop: 12 }}>
        <Settings size={20} className="muted" />
        <b className="grow">Ajustes</b>
      </a>
    </>
  );
}
