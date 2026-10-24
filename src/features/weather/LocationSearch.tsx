import { MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { type GeoResult, searchPlaces } from './weather';

export function LocationSearch({ onPick }: { onPick: (r: GeoResult) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setRes(await searchPlaces(q.trim()));
    } catch {
      setRes([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-8">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input
          className="input grow"
          placeholder={t('location.placeholder')}
          aria-label={t('location.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn soft" type="submit" disabled={busy} aria-label={t('common.search')}>
          <Search size={18} />
        </button>
      </form>
      {res && (
        <div className="list">
          {res.length === 0 && <div className="list-item muted">{t('location.noResults')}</div>}
          {res.map((r) => (
            <button
              key={`${r.lat},${r.lon}`}
              type="button"
              className="list-item clickable"
              onClick={() => {
                onPick(r);
                setRes(null);
                setQ('');
              }}
            >
              <MapPin size={18} className="muted" aria-hidden="true" />
              <span className="grow">
                <span className="item-title block">{r.name}</span>
                <span className="item-sub block">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
