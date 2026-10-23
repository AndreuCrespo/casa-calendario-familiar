// Sample data for demo mode, in the selected language.
import { LocalBackend } from './backend';
import { addDays, startOfWeek, todayIn } from '../shared/dates';
import type { Household, Lang } from '../shared/types';

const TEXT = {
  es: {
    house: 'Casa',
    events: ['Guardería', 'Pediatra Noa', 'Centro de salud', 'Natación bebés', 'Cena con amigos', 'Turno de noche', 'Visita abuelos', 'Reunión trabajo'],
    shopping: ['Leche', 'Pañales talla 4', 'Plátanos', 'Pan', 'Yogures'],
    bought: 'Huevos',
    freq: { leche: 9, pan: 7, 'pañales talla 4': 5, huevos: 6, tomates: 4, café: 4, 'papel higiénico': 3, fruta: 3 },
    tasks: ['Sacar la basura', 'Cambiar sábanas', 'Limpiar baño', 'Llamar al fontanero'],
    menus: [
      ['Lentejas con verduras', 'Tortilla de patatas'],
      ['Pasta boloñesa', 'Crema de calabacín'],
      ['Paella', 'Sándwiches'],
      ['Pollo al horno', 'Sopa de fideos'],
      ['Merluza con patatas', 'Pizza casera'],
    ],
    dates: ['ITV coche', 'Seguro de hogar', 'Recibo de la luz'],
    expenses: ['Mercadona', 'Farmacia', 'Gasolina', 'Ropa niñas'],
    notes: [
      ['Wifi invitados', 'Red: CasaInvitados\nClave: pregunta-a-alex'],
      ['Teléfonos', 'Pediatra: 960 000 000\nGuardería: 960 111 111'],
      ['Ideas regalos', 'Cuentos de animales\nPuzzle grande'],
    ],
  },
  en: {
    house: 'Home',
    events: ['Nursery', "Noa's paediatrician", 'Health centre', 'Baby swimming', 'Dinner with friends', 'Night shift', "Grandparents' visit", 'Work meeting'],
    shopping: ['Milk', 'Size 4 nappies', 'Bananas', 'Bread', 'Yoghurts'],
    bought: 'Eggs',
    freq: { milk: 9, bread: 7, 'size 4 nappies': 5, eggs: 6, tomatoes: 4, coffee: 4, 'toilet paper': 3, fruit: 3 },
    tasks: ['Take out the bins', 'Change the bed sheets', 'Clean the bathroom', 'Call the plumber'],
    menus: [
      ['Lentil and vegetable stew', 'Spanish omelette'],
      ['Spaghetti bolognese', 'Courgette soup'],
      ['Paella', 'Sandwiches'],
      ['Roast chicken', 'Noodle soup'],
      ['Hake with potatoes', 'Homemade pizza'],
    ],
    dates: ['Car inspection', 'Home insurance', 'Electricity bill'],
    expenses: ['Supermarket', 'Pharmacy', 'Petrol', "Girls' clothes"],
    notes: [
      ['Guest Wi-Fi', 'Network: HomeGuests\nPassword: ask-alex'],
      ['Phone numbers', 'Paediatrician: 960 000 000\nNursery: 960 111 111'],
      ['Gift ideas', 'Animal story books\nBig jigsaw puzzle'],
    ],
  },
};

export function seedDemo(lang: Lang) {
  LocalBackend.reset();
  const b = new LocalBackend();
  const tx = TEXT[lang];
  const tz = 'Europe/Madrid';
  const today = todayIn(tz);
  const mon = startOfWeek(today);
  const d = (n: number) => addDays(today, n);
  const now = Date.now();

  const household: Omit<Household, 'id'> = {
    name: tx.house,
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

  const [nursery, doctor, healthCentre, swimming, dinner, night, grandparents, meeting] = tx.events;
  const ev = (e: Record<string, unknown>) => b.add('events', { exdates: [], reminderMins: null, updatedAt: now, ...e });
  ev({ title: nursery, date: mon, startTime: '09:00', endTime: '13:00', memberIds: ['k1', 'k2'], recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 1, 2, 3, 4] } });
  ev({ title: doctor, date: d(1), startTime: '17:30', endTime: '18:00', memberIds: ['k2', 'a2'], location: healthCentre, reminderMins: 60 });
  ev({ title: swimming, date: d(2), startTime: '18:00', endTime: '18:45', memberIds: ['k1', 'a1'], recurrence: { freq: 'weekly', interval: 1 } });
  ev({ title: dinner, date: d(3), startTime: '21:00', memberIds: ['a1', 'a2'] });
  ev({ title: night, date: d(1), startTime: '22:00', endTime: '06:00', memberIds: ['a2'] });
  ev({ title: grandparents, date: d(5), memberIds: ['a1', 'a2', 'k1', 'k2'] });
  ev({ title: meeting, date: today, startTime: '16:00', endTime: '17:00', memberIds: ['a1'] });

  tx.shopping.forEach((name, i) =>
    b.add('shopping', { name, done: false, addedBy: i % 2 ? 'a2' : 'a1', createdAt: now - i * 1000 }));
  b.add('shopping', { name: tx.bought, done: true, addedBy: 'a1', createdAt: now - 99999, doneAt: now - 5000 });
  b.set('meta', 'shopping', { freq: tx.freq });

  const [bins, sheets, bathroom, plumber] = tx.tasks;
  const task = (x: Record<string, unknown>) => b.add('tasks', { done: false, notes: '', createdAt: now, ...x });
  task({ title: bins, memberIds: ['a1'], due: today, repeat: { every: 2, unit: 'day' } });
  task({ title: sheets, memberIds: ['a2'], due: d(2), repeat: { every: 1, unit: 'week' } });
  task({ title: bathroom, memberIds: ['a1', 'a2'], due: d(-1), repeat: { every: 1, unit: 'week' } });
  task({ title: plumber, memberIds: ['a2'], due: null, repeat: null });

  tx.menus.forEach(([lunch, dinnerDish], i) => b.set('menu', addDays(today, i), { lunch, dinner: dinnerDish }));

  const [inspection, insurance, bill] = tx.dates;
  b.add('dates', { title: 'Lía', kind: 'birthday', date: `${Number(today.slice(0, 4)) - 3}${d(12).slice(4)}`, repeat: 'yearly', remindDays: 7, memberIds: ['k1'] });
  b.add('dates', { title: inspection, kind: 'car', date: d(20), repeat: 'none', remindDays: 15, amount: 4290 });
  b.add('dates', { title: insurance, kind: 'insurance', date: d(45), repeat: 'yearly', remindDays: 30, amount: 28700 });
  b.add('dates', { title: bill, kind: 'bill', date: d(4), repeat: 'monthly', remindDays: 1 });

  const [market, pharmacy, petrol, clothes] = tx.expenses;
  const ex = (e: Record<string, unknown>) => b.add('expenses', { kind: 'expense', splitAmong: ['a1', 'a2'], createdBy: 'demo-user', createdAt: now, ...e });
  ex({ description: market, amount: 8743, paidBy: 'a1', date: d(-1), category: 'groceries' });
  ex({ description: pharmacy, amount: 1890, paidBy: 'a2', date: d(-2), category: 'health' });
  ex({ description: petrol, amount: 6000, paidBy: 'a1', date: d(-4), category: 'car' });
  ex({ description: clothes, amount: 4599, paidBy: 'a2', date: d(-6), category: 'kids' });

  const colors = ['#FDE9A9', '#D7EEFB', '#E5DEFA'];
  tx.notes.forEach(([title, body], i) =>
    b.add('notes', { title, body, pinned: i === 0, color: colors[i], updatedAt: now - i * 1000 }));
}
