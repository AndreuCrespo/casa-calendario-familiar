// Name, description and icon of each home screen card (for the customize sheet).
import {
  CalendarClock,
  CalendarDays,
  CloudSun,
  ListChecks,
  ListTodo,
  type LucideIcon,
  ShoppingCart,
  Sparkles,
  StickyNote,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import type { MessageKey } from '../../i18n';
import type { WidgetId } from './layout';

export const WIDGET_INFO: Record<WidgetId, { label: MessageKey; sub: MessageKey; icon: LucideIcon }> = {
  hero: { label: 'widget.hero', sub: 'widget.hero.sub', icon: CloudSun },
  next: { label: 'widget.next', sub: 'widget.next.sub', icon: Sparkles },
  agenda: { label: 'widget.agenda', sub: 'widget.agenda.sub', icon: ListTodo },
  menu: { label: 'widget.menu', sub: 'widget.menu.sub', icon: UtensilsCrossed },
  week: { label: 'widget.week', sub: 'widget.week.sub', icon: CalendarDays },
  shopping: { label: 'widget.shopping', sub: 'widget.shopping.sub', icon: ShoppingCart },
  tasks: { label: 'widget.tasks', sub: 'widget.tasks.sub', icon: ListChecks },
  energy: { label: 'widget.energy', sub: 'widget.energy.sub', icon: Zap },
  dates: { label: 'widget.dates', sub: 'widget.dates.sub', icon: CalendarClock },
  expenses: { label: 'widget.expenses', sub: 'widget.expenses.sub', icon: Wallet },
  notes: { label: 'widget.notes', sub: 'widget.notes.sub', icon: StickyNote },
};
