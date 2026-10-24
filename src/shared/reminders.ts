// Event reminder options (minutes). Shared so the notifier knows how far ahead
// it has to look for events.

/** Timed events: minutes before the start. */
export const TIMED_REMINDERS = [0, 10, 30, 60, 120, 1440] as const;
/** All-day events: minutes before 09:00 of the day (0 = 09:00 that day, 780 = 20:00 the day before). */
export const ALLDAY_REMINDERS = [0, 780] as const;
/** Reminders of all-day events count back from this local time (09:00), in minutes. */
export const ALLDAY_BASE_MIN = 9 * 60;
/** Longest reminder the app offers. The notifier ignores longer ones. */
export const MAX_REMINDER_MINS: number = Math.max(...TIMED_REMINDERS, ...ALLDAY_REMINDERS);
