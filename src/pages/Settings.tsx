import { useEffect, useState } from 'react';
import { Bell, ChevronRight, Copy, LayoutGrid, LogOut, MapPin, Moon, Plus, Share2, Trash2, Users } from 'lucide-react';
import { DashboardEditor } from '../components/DashboardEditor';
import { useApp } from '../lib/app';
import { MEMBER_COLORS, newMemberId, nextColor } from '../lib/members';
import { disablePush, enablePush, pushStatus, type PushStatus } from '../lib/push';
import { getTheme, setTheme, type ThemePref } from '../lib/theme';
import type { Member, NotifySettings } from '../shared/types';
import { LocationSearch } from '../components/LocationSearch';
import { InstallHint } from '../components/InstallHint';
import { PageHead, Sheet, toast } from '../components/ui';

export default function SettingsPage() {
  const { household, backend, members, user, demo, signOut } = useApp();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [theme, setThemeState] = useState<ThemePref>(getTheme);
  const [changingLoc, setChangingLoc] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const notify: NotifySettings = { dailySummary: true, dailyHour: 8, activity: true, ...household.notify };
  const link = `${location.origin}/?join=${household.id}`;

  const setNotify = (patch: Partial<NotifySettings>) => backend.updateHousehold({ notify: { ...notify, ...patch } });

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: household.name, text: `Únete a «${household.name}» en Casa`, url: link }); } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(link);
      toast('Enlace copiado');
    }
  };

  return (
    <>
      <PageHead title="Ajustes" sub={demo ? 'Modo demo' : user.email ?? ''} />
      <InstallHint />

      <div className="section-title"><Users size={14} /> Familia</div>
      <div className="list">
        {members.map((m) => (
          <button key={m.id} className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setEditing(m)}>
            <span className="avatar" style={{ '--c': m.color } as React.CSSProperties}>{m.name[0]?.toUpperCase()}</span>
            <div className="grow">
              <div className="item-title">{m.name}</div>
              <div className="item-sub">{m.kind === 'child' ? 'Peque · sin cuenta' : m.uid ? (m.uid === user.uid ? 'Tú' : 'Con cuenta') : 'Pendiente de unirse'}</div>
            </div>
          </button>
        ))}
        <button className="list-item clickable" style={{ width: '100%', color: 'var(--text-2)' }} onClick={() => setEditing('new')}>
          <Plus size={20} /> <b>Añadir miembro</b>
        </button>
      </div>

      {!demo && (
        <>
          <div className="section-title"><Share2 size={14} /> Invitar</div>
          <div className="card stack" style={{ gap: 10 }}>
            <p className="small muted">Comparte este enlace con tu pareja. Al abrirlo y entrar con su cuenta se unirá a «{household.name}».</p>
            <div className="row">
              <input className="input grow small" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="icon-btn solid" onClick={async () => { await navigator.clipboard.writeText(link); toast('Enlace copiado'); }} aria-label="Copiar"><Copy size={18} /></button>
            </div>
            <button className="btn soft" onClick={share}><Share2 size={17} /> Compartir enlace</button>
          </div>
        </>
      )}

      <div className="section-title"><MapPin size={14} /> Ubicación del tiempo</div>
      <div className="card stack" style={{ gap: 10 }}>
        {household.location && !changingLoc ? (
          <div className="row">
            <b className="grow">{household.location.name}</b>
            <button className="btn ghost sm" onClick={() => setChangingLoc(true)}>Cambiar</button>
          </div>
        ) : (
          <LocationSearch onPick={(r) => { backend.updateHousehold({ location: { name: r.name, lat: r.lat, lon: r.lon } }); setChangingLoc(false); }} />
        )}
      </div>

      <div className="section-title"><Bell size={14} /> Notificaciones</div>
      <div className="card stack" style={{ gap: 4 }}>
        <PushRow />
        <label className="switch">Resumen del día por la mañana
          <input type="checkbox" checked={notify.dailySummary} onChange={(e) => setNotify({ dailySummary: e.target.checked })} />
        </label>
        {notify.dailySummary && (
          <label className="field" style={{ marginBottom: 8 }}><span>Hora del resumen</span>
            <select value={notify.dailyHour} onChange={(e) => setNotify({ dailyHour: Number(e.target.value) })}>
              {[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </label>
        )}
        <label className="switch">Avisar cuando el otro añade cosas
          <input type="checkbox" checked={notify.activity} onChange={(e) => setNotify({ activity: e.target.checked })} />
        </label>
        <p className="tiny muted" style={{ paddingBottom: 6 }}>Los avisos se envían cada ~10 minutos desde GitHub Actions, así que pueden llegar con unos minutos de retraso.</p>
      </div>

      <div className="section-title"><LayoutGrid size={14} /> Inicio</div>
      <div className="list">
        <button className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setCustomizing(true)}>
          <div className="grow">
            <div className="item-title">Personalizar inicio</div>
            <div className="item-sub">Elige qué tarjetas ves y en qué orden (solo para ti)</div>
          </div>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <div className="section-title"><Moon size={14} /> Apariencia</div>
      <div className="card">
        <div className="seg" style={{ width: '100%' }}>
          {(['auto', 'light', 'dark'] as ThemePref[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setTheme(t); setThemeState(t); }}>
              {{ auto: 'Automático', light: 'Claro', dark: 'Oscuro' }[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">Casa</div>
      <div className="card stack">
        <label className="field"><span>Nombre de la casa</span>
          <input defaultValue={household.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== household.name && backend.updateHousehold({ name: e.target.value.trim() })} />
        </label>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn soft block" onClick={signOut}>
          <LogOut size={18} /> {demo ? 'Salir del modo demo (borra los datos de ejemplo)' : 'Cerrar sesión'}
        </button>
      </div>

      {editing && <MemberEditor member={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {customizing && <DashboardEditor onClose={() => setCustomizing(false)} />}
    </>
  );
}

function PushRow() {
  const { backend, user, demo } = useApp();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushStatus().then(setStatus); }, []);

  const label: Record<PushStatus, string> = {
    unsupported: 'Este navegador no admite notificaciones.',
    'needs-install': 'En iPhone, primero instala la app en la pantalla de inicio y ábrela desde allí.',
    'no-key': 'Falta configurar la clave VAPID (ver README).',
    denied: 'Has bloqueado las notificaciones. Actívalas en los ajustes del móvil para esta app.',
    off: '',
    on: '',
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) { await enablePush(backend, user.uid); toast('Notificaciones activadas en este móvil'); }
      else { await disablePush(backend); toast('Notificaciones desactivadas'); }
    } catch (e) {
      toast(String((e as Error).message));
    } finally {
      setStatus(await pushStatus());
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <>
      <label className="switch">Notificaciones en este móvil
        <input type="checkbox" disabled={busy || demo || !(status === 'on' || status === 'off')} checked={status === 'on'} onChange={(e) => toggle(e.target.checked)} />
      </label>
      {(label[status] || demo) && <p className="tiny muted" style={{ marginTop: -4, marginBottom: 6 }}>{demo ? 'No disponible en modo demo.' : label[status]}</p>}
    </>
  );
}

function MemberEditor({ member, onClose }: { member?: Member; onClose: () => void }) {
  const { backend, members, user } = useApp();
  const [name, setName] = useState(member?.name ?? '');
  const [color, setColor] = useState(member?.color ?? nextColor(members));
  const [kind, setKind] = useState<Member['kind']>(member?.kind ?? 'child');
  const isMe = member?.uid === user.uid;

  const save = () => {
    if (!name.trim()) { toast('Escribe un nombre'); return; }
    const next = member
      ? members.map((m) => (m.id === member.id ? { ...m, name: name.trim(), color, kind: m.uid ? 'adult' as const : kind } : m))
      : [...members, { id: newMemberId(), name: name.trim(), color, kind, uid: null }];
    backend.updateHousehold({ members: next });
    onClose();
  };

  const remove = () => {
    if (!member || isMe) return;
    backend.updateHousehold({
      members: members.filter((m) => m.id !== member.id),
      ...(member.uid ? { memberUids: members.filter((m) => m.uid && m.id !== member.id).map((m) => m.uid!) } : {}),
    });
    onClose();
  };

  return (
    <Sheet
      title={member ? 'Editar miembro' : 'Nuevo miembro'}
      onClose={onClose}
      footer={<>
        {member && !isMe && <button className="btn danger" style={{ flex: 'none' }} onClick={remove} aria-label="Quitar"><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>Guardar</button>
      </>}
    >
      <label className="field"><span>Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!member} />
      </label>
      {!member?.uid && (
        <div className="field"><span>Tipo</span>
          <div className="seg">
            <button className={kind === 'child' ? 'on' : ''} onClick={() => setKind('child')}>Peque (sin cuenta)</button>
            <button className={kind === 'adult' ? 'on' : ''} onClick={() => setKind('adult')}>Adulto</button>
          </div>
        </div>
      )}
      <div className="field"><span>Color</span>
        <div className="swatches">
          {MEMBER_COLORS.map((c) => (
            <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ '--sc': c } as React.CSSProperties} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
