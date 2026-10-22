import { useEffect, useState } from 'react';

interface Entry<T> { at: number; data: T }

function readCache<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem('casa-cache:' + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem('casa-cache:' + key, JSON.stringify({ at: Date.now(), data }));
  } catch { /* almacenamiento lleno: no pasa nada */ }
}

/**
 * Datos externos (tiempo, luz) con caché en localStorage.
 * Muestra lo cacheado al instante y refresca si ha caducado.
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>, ttlMs: number) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; loading: boolean }>(() => {
    const c = key ? readCache<T>(key) : null;
    return { key, data: c?.data, loading: !!key };
  });

  useEffect(() => {
    if (!key) { setState({ key, loading: false }); return; }
    let alive = true;
    const run = () => {
      const c = readCache<T>(key);
      if (c) setState((s) => ({ ...s, key, data: c.data }));
      if (c && Date.now() - c.at < ttlMs) { setState((s) => ({ ...s, loading: false })); return; }
      setState((s) => ({ ...s, loading: true }));
      fetcher().then(
        (data) => { if (!alive) return; writeCache(key, data); setState({ key, data, loading: false }); },
        (e) => { if (!alive) return; setState((s) => ({ ...s, key, loading: false, error: String(e?.message ?? e) })); },
      );
    };
    run();
    const vis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(run, Math.min(ttlMs, 15 * 60_000));
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttlMs]);

  return state.key === key ? state : { key, loading: true } as typeof state;
}
