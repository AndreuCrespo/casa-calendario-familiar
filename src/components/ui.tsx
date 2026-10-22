import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, X,
  type LucideIcon,
} from 'lucide-react';
import type { Member } from '../shared/types';
import { weatherKind } from '../lib/weather';

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="grow">
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children}
    </header>
  );
}

export function Sheet({ title, onClose, children, footer }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);

    // Android: el botón o gesto «atrás» cierra la hoja en vez de cambiar de pantalla.
    // Se añade una entrada al historial mientras está abierta (con setTimeout para
    // que el doble montaje de StrictMode en desarrollo no deje entradas sueltas).
    const id = Math.random().toString(36).slice(2);
    let pushed = false;
    let closedByBack = false;
    const t = setTimeout(() => { history.pushState({ casaSheet: id }, ''); pushed = true; }, 0);
    const onPop = () => { closedByBack = true; closeRef.current(); };
    window.addEventListener('popstate', onPop);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      clearTimeout(t);
      // Cerrada con ✕ o Guardar: quitar la entrada que añadimos (si seguimos en ella).
      if (pushed && !closedByBack && history.state?.casaSheet === id) history.back();
    };
  }, []);

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon size={26} /></div>
      <b>{title}</b>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function CheckCircle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button className={`check${on ? ' on' : ''}`} onClick={onClick} aria-label={label ?? (on ? 'Desmarcar' : 'Marcar')}>
      <Check size={16} strokeWidth={3.2} />
    </button>
  );
}

export function MemberDots({ ids, members }: { ids?: string[]; members: Member[] }) {
  if (!ids?.length) return null;
  return (
    <span className="dots">
      {ids.map((id) => {
        const m = members.find((x) => x.id === id);
        return m ? <span key={id} className="dot" style={{ background: m.color }} title={m.name} /> : null;
      })}
    </span>
  );
}

export function MemberPicker({ members, value, onChange, single }: {
  members: Member[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  return (
    <div className="chips">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            style={{ '--c': m.color } as CSSProperties}
            onClick={() => onChange(single ? [m.id] : on ? value.filter((x) => x !== m.id) : [...value, m.id])}
          >
            <span className="dot" />{m.name}
          </button>
        );
      })}
    </div>
  );
}

/** Color de la barra de un evento según sus miembros. */
export function memberColorStyle(ids: string[] | undefined, members: Member[]): CSSProperties {
  const cs = (ids ?? []).map((id) => members.find((m) => m.id === id)?.color).filter(Boolean) as string[];
  return { '--c': cs[0] ?? 'var(--border-strong)', '--c1': cs[0], '--c2': cs[1] ?? cs[0] } as CSSProperties;
}

export function WeatherIcon({ code, isDay = true, size = 20, className }: { code: number; isDay?: boolean; size?: number; className?: string }) {
  const k = weatherKind(code);
  const props = { size, className, strokeWidth: 1.8 };
  switch (k) {
    case 'clear': return isDay ? <Sun {...props} color="#F5B638" /> : <Moon {...props} />;
    case 'partly': return isDay ? <CloudSun {...props} /> : <Cloud {...props} />;
    case 'cloudy': return <Cloud {...props} />;
    case 'fog': return <CloudFog {...props} />;
    case 'drizzle': return <CloudDrizzle {...props} />;
    case 'rain': return <CloudRain {...props} />;
    case 'snow': return <CloudSnow {...props} />;
    default: return <CloudLightning {...props} />;
  }
}

// ---------- avisos breves ----------

interface ToastMsg { id: number; text: string; action?: { label: string; run: () => void } }
let pushToast: ((t: Omit<ToastMsg, 'id'>) => void) | null = null;

export function toast(text: string, action?: ToastMsg['action']) {
  pushToast?.({ text, action });
}

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    pushToast = (t) => setMsg({ ...t, id: Date.now() });
    const onErr = (e: Event) => setMsg({ id: Date.now(), text: `Error: ${(e as CustomEvent).detail}` });
    window.addEventListener('casa:error', onErr);
    return () => { pushToast = null; window.removeEventListener('casa:error', onErr); };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return createPortal(
    <div className="toast" key={msg.id}>
      <span>{msg.text}</span>
      {msg.action && <button onClick={() => { msg.action!.run(); setMsg(null); }}>{msg.action.label}</button>}
    </div>,
    document.body,
  );
}

export function Spinner() {
  return <div className="spinner" />;
}
