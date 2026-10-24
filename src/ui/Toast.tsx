// Short messages at the bottom of the screen, optionally with an action (Undo).
// The host is mounted once at the root, so it also works on the sign-in screens.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { type AppError, onAppError } from '../core/errors';
import { t } from '../i18n';

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let current: ToastMsg | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function set(msg: ToastMsg | null) {
  current = msg;
  for (const fn of listeners) fn();
}

export function toast(text: string, action?: ToastMsg['action']) {
  set({ id: ++seq, text, action });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function errorText(e: AppError) {
  if (e.code === 'permission-denied') return t('error.permission');
  if (e.code === 'unavailable') return t('error.offline');
  if (e.code === 'resource-exhausted') return t('error.quota');
  return t('common.errorPrefix', { msg: e.message });
}

// Popovers live in the browser's top layer, so the toast also shows above open sheets.
const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

export function ToastHost() {
  const msg = useSyncExternalStore(subscribe, () => current);
  const [paused, setPaused] = useState(false);
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => onAppError((e) => toast(errorText(e))), []);

  useEffect(() => {
    if (!msg || paused) return;
    const timer = setTimeout(() => set(null), msg.action ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [msg, paused]);

  // Show the region again for each message so it's above any sheet opened since.
  useEffect(() => {
    const el = region.current;
    if (!el || !supportsPopover || !msg) return;
    if (el.matches(':popover-open')) el.hidePopover();
    el.showPopover();
  }, [msg]);

  return createPortal(
    <div
      ref={region}
      className="toast-region"
      popover={supportsPopover ? 'manual' : undefined}
      role="status"
      aria-live="polite"
    >
      {msg && (
        // biome-ignore lint/a11y/noStaticElementInteractions: hovering only pauses the timer
        <div
          className="toast"
          key={msg.id}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span>{msg.text}</span>
          {msg.action && (
            <button
              type="button"
              onClick={() => {
                msg.action?.run();
                set(null);
              }}
            >
              {msg.action.label}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
