import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { isIOS, isStandalone } from '../lib/push';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
});

/** Explica cómo instalar la app si aún se usa desde el navegador. */
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
        <div>Para instalarla en el iPhone: en Safari pulsa <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>. Así funcionan las notificaciones.</div>
      </div>
    );
  }
  if (canPrompt) {
    return (
      <div className="banner">
        <Download size={22} />
        <div className="grow">Instala la app en el móvil para abrirla como una más.</div>
        <button className="btn sm" onClick={async () => { await deferred?.prompt(); deferred = null; setCanPrompt(false); }}>Instalar</button>
      </div>
    );
  }
  return null;
}
