import { useEffect, useState, type CSSProperties } from 'react';
import { Bell, ChevronRight, Copy, Languages, LayoutGrid, LogOut, MapPin, Moon, Plus, Share2, Trash2, Users } from 'lucide-react';
import { DashboardEditor } from '../components/DashboardEditor';
import { useApp } from '../lib/app';
import { MEMBER_COLORS, newMemberId, nextColor } from '../lib/members';
import { disablePush, enablePush, pushStatus, updatePushLang, type PushStatus } from '../lib/push';
import { getTheme, setTheme, type ThemePref } from '../lib/theme';
import type { Member, NotifySettings } from '../shared/types';
import { LocationSearch } from '../components/LocationSearch';
import { InstallHint } from '../components/InstallHint';
import { PageHead, Sheet, toast } from '../components/ui';
import { LANGS, setLang, t, useLang, type Lang, type MessageKey } from '../i18n';

const THEMES: { id: ThemePref; label: MessageKey }[] = [
  { id: 'auto', label: 'settings.themeAuto' },
  { id: 'light', label: 'settings.themeLight' },
  { id: 'dark', label: 'settings.themeDark' },
];

export default function SettingsPage() {
  const { household, backend, members, user, demo, signOut } = useApp();
  const lang = useLang();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [theme, setThemeState] = useState<ThemePref>(getTheme);
  const [changingLoc, setChangingLoc] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const notify: NotifySettings = { dailySummary: true, dailyHour: 8, activity: true, ...household.notify };
  const link = `${location.origin}/?join=${household.id}`;

  const setNotify = (patch: Partial<NotifySettings>) => backend.updateHousehold({ notify: { ...notify, ...patch } });

  const changeLang = (l: Lang) => {
    setLang(l);
    // This device's notifications follow the app language
    if (!demo) updatePushLang(backend).catch((e) => console.warn(e));
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: household.name, text: t('invite.shareText', { name: household.name }), url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      toast(t('invite.copied'));
    }
  };

  const memberStatus = (m: Member) => {
    if (m.kind === 'child') return t('settings.memberChild');
    if (!m.uid) return t('settings.memberPending');
    return m.uid === user.uid ? t('settings.memberYou') : t('settings.memberAccount');
  };

  return (
    <>
      <PageHead title={t('nav.settings')} sub={demo ? t('settings.demoMode') : user.email ?? ''} />
      <InstallHint />

      {/* Shown in both languages so anyone can find it */}
      <div className="section-title"><Languages size={14} /> Idioma · Language</div>
      <div className="card">
        <div className="seg" style={{ width: '100%' }}>
          {LANGS.map((l) => (
            <button key={l.id} className={lang === l.id ? 'on' : ''} style={{ flex: 1 }} onClick={() => changeLang(l.id)}>{l.label}</button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>{t('settings.languageHint')}</p>
      </div>

      <div className="section-title"><Users size={14} /> {t('settings.family')}</div>
      <div className="list">
        {members.map((m) => (
          <button key={m.id} className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setEditing(m)}>
            <span className="avatar" style={{ '--c': m.color } as CSSProperties}>{m.name[0]?.toUpperCase()}</span>
            <div className="grow">
              <div className="item-title">{m.name}</div>
              <div className="item-sub">{memberStatus(m)}</div>
            </div>
          </button>
        ))}
        <button className="list-item clickable" style={{ width: '100%', color: 'var(--text-2)' }} onClick={() => setEditing('new')}>
          <Plus size={20} /> <b>{t('settings.addMember')}</b>
        </button>
      </div>

      {!demo && (
        <>
          <div className="section-title"><Share2 size={14} /> {t('settings.invite')}</div>
          <div className="card stack" style={{ gap: 10 }}>
            <p className="small muted">{t('settings.inviteText', { name: household.name })}</p>
            <div className="row">
              <input className="input grow small" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="icon-btn solid" onClick={async () => { await navigator.clipboard.writeText(link); toast(t('invite.copied')); }} aria-label={t('common.copy')}><Copy size={18} /></button>
            </div>
            <button className="btn soft" onClick={share}><Share2 size={17} /> {t('settings.shareLink')}</button>
          </div>
        </>
      )}

      <div className="section-title"><MapPin size={14} /> {t('settings.weatherLocation')}</div>
      <div className="card stack" style={{ gap: 10 }}>
        {household.location && !changingLoc ? (
          <div className="row">
            <b className="grow">{household.location.name}</b>
            <button className="btn ghost sm" onClick={() => setChangingLoc(true)}>{t('common.change')}</button>
          </div>
        ) : (
          <LocationSearch onPick={(r) => { backend.updateHousehold({ location: { name: r.name, lat: r.lat, lon: r.lon } }); setChangingLoc(false); }} />
        )}
      </div>

      <div className="section-title"><Bell size={14} /> {t('settings.notifications')}</div>
      <div className="card stack" style={{ gap: 4 }}>
        <PushRow />
        <label className="switch">{t('settings.dailySummary')}
          <input type="checkbox" checked={notify.dailySummary} onChange={(e) => setNotify({ dailySummary: e.target.checked })} />
        </label>
        {notify.dailySummary && (
          <label className="field" style={{ marginBottom: 8 }}><span>{t('settings.summaryTime')}</span>
            <select value={notify.dailyHour} onChange={(e) => setNotify({ dailyHour: Number(e.target.value) })}>
              {[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </label>
        )}
        <label className="switch">{t('settings.activity')}
          <input type="checkbox" checked={notify.activity} onChange={(e) => setNotify({ activity: e.target.checked })} />
        </label>
        <p className="tiny muted" style={{ paddingBottom: 6 }}>{t('settings.notifyTiming')}</p>
      </div>

      <div className="section-title"><LayoutGrid size={14} /> {t('nav.home')}</div>
      <div className="list">
        <button className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setCustomizing(true)}>
          <div className="grow">
            <div className="item-title">{t('dash.customize')}</div>
            <div className="item-sub">{t('settings.customizeHint')}</div>
          </div>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <div className="section-title"><Moon size={14} /> {t('settings.appearance')}</div>
      <div className="card">
        <div className="seg" style={{ width: '100%' }}>
          {THEMES.map((th) => (
            <button key={th.id} className={theme === th.id ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setTheme(th.id); setThemeState(th.id); }}>
              {t(th.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">{t('settings.household')}</div>
      <div className="card stack">
        <label className="field"><span>{t('onboarding.houseName')}</span>
          <input defaultValue={household.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== household.name && backend.updateHousehold({ name: e.target.value.trim() })} />
        </label>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn soft block" onClick={signOut}>
          <LogOut size={18} /> {demo ? t('settings.exitDemo') : t('settings.signOut')}
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

  const hint: Record<PushStatus, MessageKey | null> = {
    unsupported: 'push.unsupported',
    'needs-install': 'push.needsInstall',
    'no-key': 'push.noKeyHint',
    denied: 'push.blocked',
    off: null,
    on: null,
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) { await enablePush(backend, user.uid); toast(t('push.enabled')); }
      else { await disablePush(backend); toast(t('push.disabled')); }
    } catch (e) {
      toast(String((e as Error).message));
    } finally {
      setStatus(await pushStatus());
      setBusy(false);
    }
  };

  if (!status) return null;
  const note = demo ? t('push.notInDemo') : hint[status] ? t(hint[status]!) : '';
  return (
    <>
      <label className="switch">{t('push.thisDevice')}
        <input type="checkbox" disabled={busy || demo || !(status === 'on' || status === 'off')} checked={status === 'on'} onChange={(e) => toggle(e.target.checked)} />
      </label>
      {note && <p className="tiny muted" style={{ marginTop: -4, marginBottom: 6 }}>{note}</p>}
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
    if (!name.trim()) { toast(t('settings.needName')); return; }
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
      title={member ? t('settings.editMember') : t('settings.newMember')}
      onClose={onClose}
      footer={<>
        {member && !isMe && <button className="btn danger" style={{ flex: 'none' }} onClick={remove} aria-label={t('common.remove')}><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>{t('common.save')}</button>
      </>}
    >
      <label className="field"><span>{t('dates.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!member} />
      </label>
      {!member?.uid && (
        <div className="field"><span>{t('dates.type')}</span>
          <div className="seg">
            <button className={kind === 'child' ? 'on' : ''} onClick={() => setKind('child')}>{t('settings.kindChild')}</button>
            <button className={kind === 'adult' ? 'on' : ''} onClick={() => setKind('adult')}>{t('settings.kindAdult')}</button>
          </div>
        </div>
      )}
      <div className="field"><span>{t('common.color')}</span>
        <div className="swatches">
          {MEMBER_COLORS.map((c) => (
            <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ '--sc': c } as CSSProperties} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
