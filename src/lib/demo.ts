// Datos de ejemplo para el modo demo.
import { LocalBackend } from './backend';
import { addDays, startOfWeek, todayIn } from '../shared/dates';
import type { Household } from '../shared/types';

export function seedDemo() {
  LocalBackend.reset();
  const b = new LocalBackend();
  const tz = 'Europe/Madrid';
  const today = todayIn(tz);
  const mon = startOfWeek(today);
  const d = (n: number) => addDays(today, n);
  const now = Date.now();

  const household: Omit<Household, 'id'> = {
    name: 'Casa',
    memberUids: ['demo-user'],
    members: [
      { id: 'a1', name: 'Alex', color: '#4C7DF0', kind: 'adult', uid: 'demo-user' },
      { id: 'a2', name: 'Sam', color: '#E2558A', kind: 'adult', uid: null },
      { id: 'k1', name: 'Lía', color: '#8B5CF6', kind: 'child' },
      { id: 'k2', name: 'Noa', color: '#22A06B', kind: 'child' },
    ],
    timezone: tz,
    location: { name: 'Madrid', lat: 40.4165, lon: -3.7026 },
    notify: { dailySummary: true, dailyHour: 8, activity: true },
    createdAt: now,
  };
  b.updateHousehold(household);

  const ev = (e: Record<string, unknown>) => b.add('events', { exdates: [], reminderMins: null, updatedAt: now, ...e });
  ev({ title: 'Guardería', date: mon, startTime: '09:00', endTime: '13:00', memberIds: ['k1', 'k2'], recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 1, 2, 3, 4] } });
  ev({ title: 'Pediatra Noa', date: d(1), startTime: '17:30', endTime: '18:00', memberIds: ['k2', 'a2'], location: 'Centro de salud', reminderMins: 60 });
  ev({ title: 'Natación bebés', date: d(2), startTime: '18:00', endTime: '18:45', memberIds: ['k1', 'a1'], recurrence: { freq: 'weekly', interval: 1 } });
  ev({ title: 'Cena con amigos', date: d(3), startTime: '21:00', memberIds: ['a1', 'a2'] });
  ev({ title: 'Turno de noche', date: d(1), startTime: '22:00', endTime: '06:00', memberIds: ['a2'] });
  ev({ title: 'Visita abuelos', date: d(5), memberIds: ['a1', 'a2', 'k1', 'k2'] });
  ev({ title: 'Reunión trabajo', date: today, startTime: '16:00', endTime: '17:00', memberIds: ['a1'] });

  ['Leche', 'Pañales talla 4', 'Plátanos', 'Pan', 'Yogures'].forEach((name, i) =>
    b.add('shopping', { name, done: false, addedBy: i % 2 ? 'a2' : 'a1', createdAt: now - i * 1000 }));
  b.add('shopping', { name: 'Huevos', done: true, addedBy: 'a1', createdAt: now - 99999, doneAt: now - 5000 });
  b.set('meta', 'shopping', { freq: { leche: 9, pan: 7, 'pañales talla 4': 5, huevos: 6, tomates: 4, café: 4, 'papel higiénico': 3, fruta: 3 } });

  const task = (t: Record<string, unknown>) => b.add('tasks', { done: false, notes: '', createdAt: now, ...t });
  task({ title: 'Sacar la basura', memberIds: ['a1'], due: today, repeat: { every: 2, unit: 'day' } });
  task({ title: 'Cambiar sábanas', memberIds: ['a2'], due: d(2), repeat: { every: 1, unit: 'week' } });
  task({ title: 'Limpiar baño', memberIds: ['a1', 'a2'], due: d(-1), repeat: { every: 1, unit: 'week' } });
  task({ title: 'Llamar al fontanero', memberIds: ['a2'], due: null, repeat: null });

  const menus = [
    ['Lentejas con verduras', 'Tortilla de patatas'],
    ['Pasta boloñesa', 'Crema de calabacín'],
    ['Paella', 'Sándwiches'],
    ['Pollo al horno', 'Sopa de fideos'],
    ['Merluza con patatas', 'Pizza casera'],
  ];
  menus.forEach(([lunch, dinner], i) => b.set('menu', addDays(today, i), { lunch, dinner }));

  b.add('dates', { title: 'Lía', kind: 'birthday', date: `${Number(today.slice(0, 4)) - 3}${d(12).slice(4)}`, repeat: 'yearly', remindDays: 7, memberIds: ['k1'] });
  b.add('dates', { title: 'ITV coche', kind: 'car', date: d(20), repeat: 'none', remindDays: 15, amount: 4290 });
  b.add('dates', { title: 'Seguro de hogar', kind: 'insurance', date: d(45), repeat: 'yearly', remindDays: 30, amount: 28700 });
  b.add('dates', { title: 'Recibo de la luz', kind: 'bill', date: d(4), repeat: 'monthly', remindDays: 1 });

  const ex = (e: Record<string, unknown>) => b.add('expenses', { kind: 'expense', splitAmong: ['a1', 'a2'], createdBy: 'demo-user', createdAt: now, ...e });
  ex({ description: 'Mercadona', amount: 8743, paidBy: 'a1', date: d(-1), category: 'super' });
  ex({ description: 'Farmacia', amount: 1890, paidBy: 'a2', date: d(-2), category: 'salud' });
  ex({ description: 'Gasolina', amount: 6000, paidBy: 'a1', date: d(-4), category: 'coche' });
  ex({ description: 'Ropa niñas', amount: 4599, paidBy: 'a2', date: d(-6), category: 'ninas' });

  b.add('notes', { title: 'Wifi invitados', body: 'Red: CasaInvitados\nClave: pregunta-a-alex', pinned: true, color: '#FDE9A9', updatedAt: now });
  b.add('notes', { title: 'Teléfonos', body: 'Pediatra: 960 000 000\nGuardería: 960 111 111', pinned: false, color: '#D7EEFB', updatedAt: now - 1000 });
  b.add('notes', { title: 'Ideas regalos', body: 'Cuentos de animales\nPuzzle grande', pinned: false, color: '#E5DEFA', updatedAt: now - 2000 });
}
