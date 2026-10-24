import { t } from '../../i18n';
import { AuthScreen } from './AuthScreen';

/** First screen when Firebase isn't configured: offers demo mode. */
export default function Welcome({ onDemo }: { onDemo: () => void }) {
  return (
    <AuthScreen>
      <div>
        <h1>Casa</h1>
        <p className="muted mt-6">{t('app.tagline')}</p>
      </div>
      <div className="card flat stack gap-8">
        <b>{t('welcome.notConfigured')}</b>
        <p className="small muted">{t('welcome.help')}</p>
      </div>
      <button type="button" className="btn accent block" onClick={onDemo}>
        {t('welcome.tryDemo')}
      </button>
    </AuthScreen>
  );
}
