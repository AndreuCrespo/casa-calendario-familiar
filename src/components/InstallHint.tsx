import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { isIOS, isStandalone } from '../lib/push';
import { t } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
});

/** Explains how to install the app while it's still used from the browser. */
export function InstallHint() {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  if (isStandalone()) return null;

  if (isIOS()) {
    return (
      <div className="banner">
        <Share size={22} />
        <div>{t('install.ios1')} <b>{t('install.iosShare')}</b> → <b>{t('install.iosAdd')}</b>. {t('install.ios2')}</div>
      </div>
    );
  }
  if (canPrompt) {
    return (
      <div className="banner">
        <Download size={22} />
        <div className="grow">{t('install.android')}</div>
        <button className="btn sm" onClick={async () => { await deferred?.prompt(); deferred = null; setCanPrompt(false); }}>{t('install.button')}</button>
      </div>
    );
  }
  return null;
}
