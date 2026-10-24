// Size limits for what the app stores. The client enforces them in its forms,
// firestore.rules rejects anything bigger, and the notifier clips what it sends.
// Keep firestore.rules in sync when changing a value here.

export const LIMITS = {
  householdName: 60,
  memberName: 40,
  members: 12,
  /** Titles of events, tasks, key dates and notes; expense descriptions. */
  title: 200,
  shoppingItem: 100,
  /** Long free text: event and task notes, key date notes. */
  notes: 2000,
  noteBody: 5000,
  /** Event location and household location name. */
  place: 200,
  /** Lunch or dinner of one day in the weekly menu. */
  dish: 200,
  activityText: 300,
  /** Entries in the shopping suggestions map (meta/shopping.freq). */
  shoppingFreq: 300,
  exdates: 400,
  dashboardWidgets: 30,
  /** Maximum amount in cents (one million euros). */
  amountCents: 100_000_000,
  /** How long an invite link works. */
  inviteDays: 7,
} as const;
