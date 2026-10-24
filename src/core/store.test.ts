import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Backend } from './backend/types';
import { onAppError } from './errors';
import { LiveStore } from './store';

/** A backend whose collection listeners are controlled by the test. */
function fakeBackend() {
  const opened: { coll: string; ok: (v: unknown) => void; fail: (e: Error) => void; closed: boolean }[] = [];
  const backend = {
    householdId: 'h',
    watch: (coll: string, ok: (v: unknown) => void, fail: (e: Error) => void) => {
      const l = { coll, ok, fail, closed: false };
      opened.push(l);
      return () => {
        l.closed = true;
      };
    },
  } as unknown as Backend;
  return { backend, opened };
}

describe('LiveStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shares one listener per collection and passes on new data', () => {
    const { backend, opened } = fakeBackend();
    const store = new LiveStore(backend);
    const entry = store.collection('tasks');
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(entry, a);
    store.subscribe(store.collection('tasks'), b);
    expect(opened).toHaveLength(1);
    opened[0]?.ok([{ id: '1' }]);
    expect(entry.value).toEqual([{ id: '1' }]);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('closes a listener a while after its last screen leaves, unless one comes back', () => {
    const { backend, opened } = fakeBackend();
    const store = new LiveStore(backend);
    const entry = store.collection('notes');
    const off = store.subscribe(entry, () => {});
    off();
    vi.advanceTimersByTime(60_000);
    store.subscribe(entry, () => {})(); // back and gone again: the timer starts over
    vi.advanceTimersByTime(4 * 60_000);
    expect(opened[0]?.closed).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(opened[0]?.closed).toBe(true);
  });

  it('retries with growing delays and reports only a persistent failure', () => {
    const { backend, opened } = fakeBackend();
    const store = new LiveStore(backend);
    const reported = vi.fn();
    const stop = onAppError(reported);
    store.subscribe(store.collection('events'), () => {});
    opened[0]?.fail(new Error('denied'));
    vi.advanceTimersByTime(1000);
    opened[1]?.fail(new Error('denied'));
    vi.advanceTimersByTime(1999);
    expect(opened).toHaveLength(2);
    vi.advanceTimersByTime(1);
    opened[2]?.fail(new Error('denied'));
    expect(reported).toHaveBeenCalledOnce();
    expect(store.failing).toBe(true);
    vi.advanceTimersByTime(4000);
    opened[3]?.ok([]);
    expect(store.failing).toBe(false);
    stop();
  });

  it('stops everything and reopens what is still shown', () => {
    const { backend, opened } = fakeBackend();
    const store = new LiveStore(backend);
    store.subscribe(store.collection('shopping'), () => {});
    store.stop();
    expect(opened[0]?.closed).toBe(true);
    store.resume();
    expect(opened).toHaveLength(2);
    expect(opened[1]?.closed).toBe(false);
  });
});
