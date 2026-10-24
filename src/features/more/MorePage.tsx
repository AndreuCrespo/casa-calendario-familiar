import { Settings } from 'lucide-react';
import { href } from '../../app/router';
import { SECTIONS } from '../../app/sections';
import { t } from '../../i18n';
import { PageHead } from '../../ui/primitives';
import { InstallHint } from './InstallHint';
import './more.css';

export default function MorePage() {
  return (
    <>
      <PageHead title={t('nav.more')} />
      <InstallHint />
      <nav className="tiles" aria-label={t('nav.more')}>
        {SECTIONS.flatMap(({ route, label, icon: Icon, tile }) =>
          tile
            ? [
                <a key={route} className="tile card-link" href={href(route)}>
                  <span className="ic" style={{ '--tc': tile.color }} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span>
                    <b className="block">{t(label)}</b>
                    <span className="sub block">{t(tile.sub)}</span>
                  </span>
                </a>,
              ]
            : [],
        )}
      </nav>
      <div className="list mt-12">
        <a className="list-item card-link" href={href('settings')}>
          <Settings size={20} className="muted" aria-hidden="true" />
          <b className="grow">{t('nav.settings')}</b>
        </a>
      </div>
    </>
  );
}
