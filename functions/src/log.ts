// Structured logging (Cloud Logging severities and fields). Household ids never
// reach the logs: they grant access to the household (they used to be its
// invite code), so a short hash stands in for them.
import { createHash } from 'node:crypto';
import * as logger from 'firebase-functions/logger';

type LogFn = (message: string, fields?: Record<string, unknown>) => void;

/** Replaceable so tests can silence or capture it. */
export const log: { info: LogFn; warn: LogFn; error: LogFn } = {
  info: (message, fields) => logger.info(message, fields ?? {}),
  warn: (message, fields) => logger.warn(message, fields ?? {}),
  error: (message, fields) => logger.error(message, fields ?? {}),
};

/** Stable, non-reversible stand-in for a household id. */
export const householdTag = (hid: string) => `h_${createHash('sha256').update(hid).digest('hex').slice(0, 10)}`;

/** An error as text, with the household id (e.g. inside a document path) replaced by its tag. */
export function errorText(e: unknown, hid?: string): string {
  const text = e instanceof Error ? (e.stack ?? e.message) : String(e);
  return hid ? text.split(hid).join(householdTag(hid)) : text;
}
