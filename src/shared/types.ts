// Data model shared by the app and the notifier.
// All dates are local 'YYYY-MM-DD' strings and times are 'HH:mm', in the
// household's time zone (avoids trouble with daylight-saving changes).

/** UI / notification language. */
export type Lang = 'es' | 'en';

export type MemberKind = 'adult' | 'child';

export interface Member {
  id: string;
  name: string;
  color: string;
  kind: MemberKind;
  uid?: string | null; // linked account (adults only)
}

export interface Household {
  id: string;
  name: string;
  memberUids: string[];
  members: Member[];
  timezone: string;
  location?: { name: string; lat: number; lon: number } | null;
  notify?: NotifySettings;
  createdAt: number;
}

export interface NotifySettings {
  dailySummary: boolean;
  dailyHour: number; // local hour of the daily summary
  activity: boolean; // "X added milk to the shopping list"
}

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  freq: Freq;
  interval: number;
  byWeekday?: number[]; // 0 = Monday … 6 = Sunday
  until?: string | null;
}

export interface CalEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string | null; // inclusive, for multi-day events
  startTime?: string | null; // null => all day
  endTime?: string | null;
  memberIds: string[];
  recurrence?: Recurrence | null;
  exdates?: string[];
  reminderMins?: number | null; // minutes before (all-day events: relative to 09:00)
  location?: string;
  notes?: string;
  createdBy?: string;
  updatedAt?: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  done: boolean;
  addedBy?: string;
  createdAt: number;
  doneAt?: number | null;
}

export type RepeatUnit = 'day' | 'week' | 'month';

export interface Task {
  id: string;
  title: string;
  memberIds: string[];
  due?: string | null;
  repeat?: { every: number; unit: RepeatUnit } | null;
  done: boolean;
  lastDoneAt?: number | null;
  lastDoneBy?: string | null;
  notes?: string;
  createdAt: number;
}

export interface MenuDay {
  id: string; // 'YYYY-MM-DD'
  lunch?: string;
  dinner?: string;
}

export type KeyDateKind = 'birthday' | 'car' | 'insurance' | 'bill' | 'health' | 'school' | 'other';

export interface KeyDate {
  id: string;
  title: string;
  kind: KeyDateKind;
  date: string; // for birthdays, the date of birth
  repeat: 'none' | 'monthly' | 'yearly';
  remindDays: number;
  memberIds?: string[];
  amount?: number | null; // cents
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number; // cents
  paidBy: string; // member id
  splitAmong: string[]; // member ids (for 'settle', the one who receives)
  date: string;
  category: string;
  kind: 'expense' | 'settle';
  createdBy?: string;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  color: string;
  updatedAt: number;
  updatedBy?: string;
}

export interface Device {
  id: string;
  uid: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  ua: string;
  createdAt: number;
  /** Language for this device's notifications (missing or unknown ⇒ 'es'). */
  lang?: Lang;
}

export type ActivityKind = 'shopping' | 'event' | 'task' | 'note' | 'expense' | 'date' | 'menu';

export interface Activity {
  id: string;
  actorUid: string;
  actorName: string;
  kind: ActivityKind;
  text: string; // e.g. "milk"
  createdAt: number;
  notified: boolean;
}
