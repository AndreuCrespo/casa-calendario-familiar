import { LIMITS } from '../../shared/limits';
import type { ShoppingItem } from '../../shared/types';

export const normalizeItem = (s: string) => s.trim().toLowerCase();

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Several items can be typed at once, separated by commas or lines: "milk, bread, eggs". */
export function splitItems(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim().slice(0, LIMITS.shoppingItem))
    .filter(Boolean);
}

/** Frequent items that aren't already on the list. */
export function suggestions(freq: Readonly<Record<string, number>>, pending: readonly ShoppingItem[], limit = 12) {
  const inList = new Set(pending.map((i) => normalizeItem(i.name)));
  return Object.entries(freq)
    .filter(([k]) => !inList.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => capitalize(k));
}

/**
 * New counts for the items just added: the changed entries (merged into the
 * stored map) or, when the map would outgrow its limit, the whole map without
 * the rarest items.
 */
export function nextFreq(
  freq: Readonly<Record<string, number>>,
  added: readonly string[],
): { merge: Record<string, number> } | { replace: Record<string, number> } {
  const changed: Record<string, number> = {};
  for (const n of added) changed[normalizeItem(n)] = (freq[normalizeItem(n)] ?? 0) + 1;
  const all = { ...freq, ...changed };
  const keys = Object.keys(all);
  if (keys.length <= LIMITS.shoppingFreq) return { merge: changed };
  const kept = Object.entries(all)
    .sort((a, b) => (b[0] in changed ? 1 : 0) - (a[0] in changed ? 1 : 0) || b[1] - a[1])
    .slice(0, LIMITS.shoppingFreq);
  return { replace: Object.fromEntries(kept) };
}
