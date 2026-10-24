import { Settings2 } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';
import { useApp, useToday } from '../../core/app';
import { t } from '../../i18n';
import type { DateStr } from '../../shared/dates';
import type { Occurrence } from '../../shared/recurrence';
import type { CalEvent } from '../../shared/types';
import { EventEditor } from '../calendar/EventEditor';
import { useWeather } from '../weather/weather';
import { AgendaCard } from './cards/AgendaCard';
import { Hero } from './cards/Hero';
import { InviteCard } from './cards/InviteCard';
import { NextCard } from './cards/NextCard';
import {
  DatesCard,
  EnergyCard,
  ExpensesCard,
  MenuTodayCard,
  NotesCard,
  ShoppingCard,
  TasksCard,
} from './cards/SummaryCards';
import { WeekStrip } from './cards/WeekStrip';
import { DashboardEditor } from './DashboardEditor';
import { packSpans, type WidgetId } from './layout';
import { useDashboardLayout } from './useDashboardLayout';
import './dashboard.css';

export default function DashboardPage() {
  const { household, demo } = useApp();
  const today = useToday();
  const layout = useDashboardLayout();
  const weather = useWeather().data;
  const [editing, setEditing] = useState<{ event: CalEvent; occurrence: DateStr } | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const openOcc = useCallback((o: Occurrence) => setEditing({ event: o.event, occurrence: o.date }), []);

  const cards: Record<WidgetId, () => ReactNode> = {
    hero: () => <Hero weather={weather} />,
    next: () => <NextCard onOpen={openOcc} />,
    agenda: () => <AgendaCard today={today} onOpen={openOcc} />,
    menu: () => <MenuTodayCard today={today} />,
    week: () => <WeekStrip today={today} weather={weather} onOpen={openOcc} />,
    shopping: () => <ShoppingCard />,
    tasks: () => <TasksCard today={today} />,
    energy: () => <EnergyCard />,
    dates: () => <DatesCard today={today} />,
    expenses: () => <ExpensesCard today={today} />,
    notes: () => <NotesCard />,
  };

  const visible = layout.order.filter((id) => !layout.hidden.has(id));
  const spans = packSpans(visible);

  return (
    <div className="dash">
      <h1 className="sr-only">{t('nav.home')}</h1>
      {!demo && household.memberUids.length < 2 && (
        <div className="w m-2 d-3">
          <InviteCard />
        </div>
      )}
      {layout.loaded &&
        visible.map((id) => {
          const span = spans.get(id);
          return (
            <div key={id} className={`w m-${span?.m ?? 2} d-${span?.d ?? 3}`}>
              {cards[id]()}
            </div>
          );
        })}
      {layout.loaded && visible.length === 0 && (
        <div className="w m-2 d-3 card center pad-32">
          <p className="muted">{t('dash.allHidden')}</p>
        </div>
      )}
      {layout.loaded && (
        <div className="w m-2 d-3 center-items">
          <button type="button" className="btn ghost sm flex-none" onClick={() => setCustomizing(true)}>
            <Settings2 size={16} aria-hidden="true" /> {t('dash.customize')}
          </button>
        </div>
      )}
      {editing && <EventEditor mode="edit" {...editing} onClose={() => setEditing(null)} />}
      {customizing && <DashboardEditor layout={layout} onClose={() => setCustomizing(false)} />}
    </div>
  );
}
