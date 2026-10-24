// App-wide error channel: the data layer reports failures here and the toast
// host (mounted at the root, so it also covers the sign-in screens) shows them.

export interface AppError {
  /** Firebase error code without prefix, e.g. 'permission-denied'. */
  code: string | null;
  message: string;
}

type Listener = (e: AppError) => void;
const listeners = new Set<Listener>();

export function toAppError(e: unknown): AppError {
  const code = typeof e === 'object' && e && 'code' in e && typeof e.code === 'string' ? e.code : null;
  const message = e instanceof Error ? e.message : String(e);
  return { code: code?.replace(/^firestore\//, '') ?? null, message };
}

export function reportError(e: unknown) {
  console.error(e);
  const err = toAppError(e);
  for (const fn of listeners) fn(err);
}

export function onAppError(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
