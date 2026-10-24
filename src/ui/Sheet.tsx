// Bottom sheet (centered dialog on large screens) built on <dialog>: the
// browser handles focus, Esc, stacking and an inert background, and on Android
// the back gesture closes the top sheet instead of leaving the screen.
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { onBackGesture } from './backGesture';

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const downOnBackdrop = useRef(false);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    // Esc and the back gesture close the dialog natively; tell the owner. The
    // 'close' event arrives a moment later, so one from an earlier close() (React
    // remounts effects in development) finds the dialog open again: ignore it.
    const onDialogClose = () => {
      if (!dialog.open) close();
    };
    dialog.addEventListener('close', onDialogClose);
    const stopBack = onBackGesture(() => dialog.close());
    return () => {
      dialog.removeEventListener('close', onDialogClose);
      if (dialog.open) dialog.close();
      stopBack();
    };
  }, []);

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: only backdrop clicks; the keyboard closes it with Esc
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      // A click that starts and ends outside the sheet (on the backdrop) closes it.
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={22} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </dialog>,
    document.body,
  );
}
