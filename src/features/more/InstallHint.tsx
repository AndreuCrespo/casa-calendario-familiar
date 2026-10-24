import { Download, Share } from 'lucide-react';
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../../core/platform';
import { t } from '../../i18n';

/** Explains how to install the app while it's still used from the browser. */
export function InstallHint() {
  const canInstall = useCanInstall();
  if (isStandalone()) return null;

  if (isIOS()) {
    return (
      <div className="banner">
        <Share size={22} aria-hidden="true" />
        <div>
          {t('install.ios1')} <b>{t('install.iosShare')}</b> → <b>{t('install.iosAdd')}</b>. {t('install.ios2')}
        </div>
      </div>
    );
  }
  if (!canInstall) return null;
  return (
    <div className="banner">
      <Download size={22} aria-hidden="true" />
      <div className="grow">{t('install.android')}</div>
      <button type="button" className="btn sm" onClick={promptInstall}>
        {t('install.button')}
      </button>
    </div>
  );
}
