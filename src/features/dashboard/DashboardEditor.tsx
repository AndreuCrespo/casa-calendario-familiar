import { GripVertical, RotateCcw } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { t } from '../../i18n';
import { Sheet } from '../../ui/Sheet';
import { DEFAULT_ORDER, moveWidget, type WidgetId } from './layout';
import type { DashboardLayout } from './useDashboardLayout';
import { WIDGET_INFO } from './widgets';
import './dashboard.css';

interface Drag {
  id: WidgetId;
  from: number;
  startY: number;
  height: number;
  /** Center of each row when the drag started. */
  centers: number[];
}

/** Index where the dragged row would land, from its current center. */
function targetIndex(d: Drag, dy: number) {
  const center = (d.centers[d.from] ?? 0) + dy;
  let to = d.from;
  while (to < d.centers.length - 1 && center > (d.centers[to + 1] ?? Infinity)) to++;
  while (to > 0 && center < (d.centers[to - 1] ?? -Infinity)) to--;
  return to;
}

/**
 * Sheet to choose which cards appear on the home screen and in what order.
 * Rows are dragged by their handle, or moved with the arrow keys on it.
 */
export function DashboardEditor({ layout, onClose }: { layout: DashboardLayout; onClose: () => void }) {
  const [order, setOrder] = useState<WidgetId[]>(layout.order);
  const [hidden, setHidden] = useState<ReadonlySet<WidgetId>>(layout.hidden);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dy, setDy] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const rows = useRef(new Map<WidgetId, HTMLElement>());
  const handles = useRef(new Map<WidgetId, HTMLButtonElement>());

  // While dragging the DOM isn't reordered: rows are shifted with transforms and
  // the new order is applied on drop (so the pointer capture isn't lost).
  const target = drag ? targetIndex(drag, dy) : -1;

  const commit = (next: WidgetId[], id: WidgetId) => {
    setOrder(next);
    layout.save(next, hidden);
    setAnnouncement(t('dash.moved', { name: t(WIDGET_INFO[id].label), n: next.indexOf(id) + 1, total: next.length }));
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>, id: WidgetId) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rects = order.map((x) => rows.current.get(x)?.getBoundingClientRect());
    const from = order.indexOf(id);
    setDrag({
      id,
      from,
      startY: e.clientY,
      height: rects[from]?.height ?? 0,
      centers: rects.map((r) => (r ? r.top + r.height / 2 : 0)),
    });
    setDy(0);
  };

  const onUp = () => {
    if (!drag) return;
    const to = targetIndex(drag, dy);
    setDrag(null);
    setDy(0);
    if (to !== drag.from) commit(moveWidget(order, drag.from, to), drag.id);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: WidgetId) => {
    const from = order.indexOf(id);
    const to = e.key === 'ArrowUp' ? from - 1 : e.key === 'ArrowDown' ? from + 1 : -1;
    if (to < 0 || to >= order.length) return;
    e.preventDefault();
    commit(moveWidget(order, from, to), id);
    // Keep the focus on the handle of the row that moved.
    requestAnimationFrame(() => handles.current.get(id)?.focus());
  };

  const toggle = (id: WidgetId, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    setHidden(next);
    layout.save(order, next);
  };

  const reset = () => {
    setOrder([...DEFAULT_ORDER]);
    setHidden(new Set());
    layout.reset();
  };

  const shiftFor = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < target && i > drag.from && i <= target) return -drag.height;
    if (drag.from > target && i < drag.from && i >= target) return drag.height;
    return 0;
  };

  return (
    <Sheet
      title={t('dash.customize')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost flex-none" onClick={reset}>
            <RotateCcw size={17} aria-hidden="true" /> {t('dash.reset')}
          </button>
          <button type="button" className="btn accent" onClick={onClose}>
            {t('common.done')}
          </button>
        </>
      }
    >
      <p className="small muted sheet-intro">
        {t('dash.help1')} <GripVertical size={14} className="inline-icon" aria-hidden="true" /> {t('dash.help2')}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ul className="list dash-editor">
        {order.map((id, i) => {
          const info = WIDGET_INFO[id];
          const dragged = drag?.id === id;
          const visible = !hidden.has(id);
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) rows.current.set(id, el);
                else rows.current.delete(id);
              }}
              className={`list-item${dragged ? ' dragging' : ''}${visible ? '' : ' off'}${drag && !dragged ? ' shifting' : ''}`}
              style={{ transform: `translateY(${dragged ? dy : shiftFor(i)}px)` }}
            >
              <button
                type="button"
                className="drag-handle"
                ref={(el) => {
                  if (el) handles.current.set(id, el);
                  else handles.current.delete(id);
                }}
                aria-label={t('dash.move', { name: t(info.label) })}
                aria-describedby="dash-move-hint"
                onPointerDown={(e) => onDown(e, id)}
                onPointerMove={(e) => drag && setDy(e.clientY - drag.startY)}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={(e) => onKey(e, id)}
              >
                <GripVertical size={20} />
              </button>
              <span className="dash-editor-ic" aria-hidden="true">
                <info.icon size={18} />
              </span>
              <span className="grow">
                <span className="item-title block">{t(info.label)}</span>
                <span className="item-sub ellipsis block">{t(info.sub)}</span>
              </span>
              <label className="switch compact">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => toggle(id, e.target.checked)}
                  aria-label={t('dash.show', { name: t(info.label) })}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p id="dash-move-hint" className="sr-only">
        {t('dash.moveHint')}
      </p>
    </Sheet>
  );
}
