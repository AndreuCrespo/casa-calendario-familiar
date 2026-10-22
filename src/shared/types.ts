// Modelo de datos compartido entre la app y el notificador.
// Todas las fechas son cadenas locales 'YYYY-MM-DD' y las horas 'HH:mm'
// en la zona horaria de la casa (evita líos con cambios de hora).

export type MemberKind = 'adult' | 'child';

export interface Member {
  id: string;
  name: string;
  color: string;
  kind: MemberKind;
  uid?: string | null; // cuenta vinculada (solo adultos)
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
  dailyHour: number; // hora local del resumen diario
  activity: boolean; // "X ha añadido leche a la compra"
}

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  freq: Freq;
  interval: number;
  byWeekday?: number[]; // 0 = lunes … 6 = domingo
  until?: string | null;
}

export interface CalEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string | null; // inclusivo, para eventos de varios días
  startTime?: string | null; // null => todo el día
  endTime?: string | null;
  memberIds: string[];
  recurrence?: Recurrence | null;
  exdates?: string[];
  reminderMins?: number | null; // minutos antes (todo el día: relativo a las 09:00)
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
  date: string; // en cumpleaños, la fecha de nacimiento
  repeat: 'none' | 'monthly' | 'yearly';
  remindDays: number;
  memberIds?: string[];
  amount?: number | null; // céntimos
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number; // céntimos
  paidBy: string; // member id
  splitAmong: string[]; // member ids (en 'settle', el que recibe)
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
}

export type ActivityKind = 'shopping' | 'event' | 'task' | 'note' | 'expense' | 'date' | 'menu';

export interface Activity {
  id: string;
  actorUid: string;
  actorName: string;
  kind: ActivityKind;
  text: string; // p. ej. "leche"
  createdAt: number;
  notified: boolean;
}
