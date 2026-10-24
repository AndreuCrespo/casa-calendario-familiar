// Language-aware text helpers shared by the app and the notifier.
import type { Lang } from './types';

/**
 * Spanish "and" before `next`: 'e' when it starts with an /i/ sound ("Lía e
 * Iker", "pan e higos"), 'y' otherwise, also when that /i/ opens a diphthong
 * ("agua y hielo", "Ana y Ian").
 */
function esAnd(next: string): 'y' | 'e' {
  const w = next.trim().toLocaleLowerCase('es');
  return /^h?[ií]/.test(w) && !/^h?i[aeouáéóú]/.test(w) ? 'e' : 'y';
}

/** 'a, b y c' (es) / 'a, b and c' (en). Blank items are skipped. */
export function joinList(items: string[], lang: Lang): string {
  const xs = items.filter((s) => s.trim() !== '');
  const last = xs.at(-1);
  if (last === undefined || xs.length === 1) return last ?? '';
  const and = lang === 'es' ? esAnd(last) : 'and';
  return `${xs.slice(0, -1).join(', ')} ${and} ${last}`;
}

/**
 * Cuts `text` to at most `max` code points, ending in '…' when it was longer.
 * Never splits an emoji or any other character outside the BMP in half.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text; // UTF-16 length ≥ code points
  const cps = Array.from(text);
  if (cps.length <= max) return text;
  if (max <= 0) return '';
  return `${cps
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`;
}
