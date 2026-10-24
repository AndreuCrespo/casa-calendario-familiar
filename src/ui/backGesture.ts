// Android's back gesture should close the open sheet, not leave the screen.
// Browsers with CloseWatcher (Chrome) already do that for modal dialogs. In the
// others, each open sheet adds a history entry and Back closes the top one.

const native = typeof window !== 'undefined' && 'CloseWatcher' in window;

const handlers = new Map<string, () => void>();
const stack: string[] = [];
/** Back navigations we started ourselves (closing a sheet with ✕ or Save). */
let ownPops = 0;
let listening = false;

function onPopState() {
  if (ownPops > 0) {
    ownPops--;
    return;
  }
  const id = stack.pop();
  if (!id) return;
  const fn = handlers.get(id);
  handlers.delete(id);
  fn?.();
}

/** Calls `onBack` when Back is pressed while this is the top sheet. Returns a cleanup. */
export function onBackGesture(onBack: () => void): () => void {
  if (native) return () => {};
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const id = Math.random().toString(36).slice(2);
  let pushed = false;
  // Deferred so React's development double mount doesn't leave stray entries.
  const timer = setTimeout(() => {
    stack.push(id);
    handlers.set(id, onBack);
    history.pushState({ casaSheet: id }, '');
    pushed = true;
  }, 0);
  return () => {
    clearTimeout(timer);
    const i = stack.indexOf(id);
    if (!pushed || i === -1) return; // never added, or already closed by Back
    stack.splice(i, 1);
    handlers.delete(id);
    // Closed another way: drop our entry if we're still on it.
    if (history.state?.casaSheet === id) {
      ownPops++;
      history.back();
    }
  };
}
