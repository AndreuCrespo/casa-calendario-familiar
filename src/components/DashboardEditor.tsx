import { useRef, useState, type PointerEvent } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { DEFAULT_ORDER, useDashboardLayout, widgetMeta, type WidgetId } from '../lib/dashboard';
import { Sheet } from './ui';
import { t } from '../i18n';

interface Drag {
  id: WidgetId;
  from: number;
  startY: number;
  height: number;
  centers: number[]; // center of each row when the drag started
}

/** Sheet to choose which cards appear on the home screen and in what order. */
export function DashboardEditor({ onClose }: { onClose: () => void }) {
  const layout = useDashboardLayout();
  const [order, setOrder] = useState<WidgetId[]>(layout.order);
  const [hidden, setHidden] = useState<Set<WidgetId>>(layout.hidden);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dy, setDy] = useState(0);
  const rows = useRef(new Map<WidgetId, HTMLElement>());

  // While dragging, the DOM isn't reordered: rows are shifted with transforms and
  // the real order is applied on drop (so the pointer capture isn't lost).
  const target = drag ? targetIndex(drag, dy) : -1;

  const onDown = (e: PointerEvent, id: WidgetId) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rects = order.map((x) => rows.current.get(x)!.getBoundingClientRect());
    const from = order.indexOf(id);
    setDrag({ id, from, startY: e.clientY, height: rects[from].height, centers: rects.map((r) => r.top + r.height / 2) });
    setDy(0);
  };

  const onMove = (e: PointerEvent) => {
    if (drag) setDy(e.clientY - drag.startY);
  };

  const onUp = () => {
    if (!drag) return;
    const to = targetIndex(drag, dy);
    setDrag(null);
    setDy(0);
    if (to === drag.from) return;
    const next = [...order];
    next.splice(drag.from, 1);
    next.splice(to, 0, drag.id);
    setOrder(next);
    layout.save(next, hidden);
  };

  const toggle = (id: WidgetId, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id); else next.add(id);
    setHidden(next);
    layout.save(order, next);
  };

  const reset = () => {
    setOrder(DEFAULT_ORDER);
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
      footer={<>
        <button className="btn ghost" style={{ flex: 'none' }} onClick={reset}><RotateCcw size={17} /> {t('dash.reset')}</button>
        <button className="btn accent" onClick={onClose}>{t('common.done')}</button>
      </>}
    >
      <p className="small muted" style={{ marginTop: -4 }}>
        {t('dash.help1')} <GripVertical size={14} style={{ verticalAlign: -2 }} /> {t('dash.help2')}
      </p>
      <div className="list dash-editor">
        {order.map((id, i) => {
          const m = widgetMeta(id);
          const isDragged = drag?.id === id;
          const visible = !hidden.has(id);
          return (
            <div
              key={id}
              ref={(el) => { if (el) rows.current.set(id, el); else rows.current.delete(id); }}
              className={`list-item${isDragged ? ' dragging' : ''}${visible ? '' : ' off'}`}
              style={{
                transform: `translateY(${isDragged ? dy : shiftFor(i)}px)`,
                transition: drag && !isDragged ? 'transform .15s ease' : 'none',
              }}
            >
              <button
                className="drag-handle"
                aria-label={t('dash.move', { name: t(m.label) })}
                onPointerDown={(e) => onDown(e, id)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <GripVertical size={20} />
              </button>
              <span className="dash-editor-ic"><m.icon size={18} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="item-title">{t(m.label)}</div>
                <div className="item-sub ellipsis">{t(m.sub)}</div>
              </div>
              <label className="switch" style={{ minHeight: 0 }}>
                <input type="checkbox" checked={visible} onChange={(e) => toggle(id, e.target.checked)} aria-label={t('dash.show', { name: t(m.label) })} />
              </label>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Index where the dragged row would land, from its current center. */
function targetIndex(d: Drag, dy: number) {
  const center = d.centers[d.from] + dy;
  let to = d.from;
  while (to < d.centers.length - 1 && center > d.centers[to + 1]) to++;
  while (to > 0 && center < d.centers[to - 1]) to--;
  return to;
}
