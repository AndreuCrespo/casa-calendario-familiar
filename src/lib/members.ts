import type { Member } from '../shared/types';

export const MEMBER_COLORS = [
  '#4C7DF0', // azul
  '#E2558A', // rosa
  '#8B5CF6', // violeta
  '#22A06B', // verde
  '#F08C2E', // naranja
  '#14A3B8', // turquesa
  '#D9483B', // rojo
  '#A16207', // mostaza
];

export function nextColor(used: Member[]) {
  return MEMBER_COLORS.find((c) => !used.some((m) => m.color === c)) ?? MEMBER_COLORS[used.length % MEMBER_COLORS.length];
}

export function newMemberId() {
  return Math.random().toString(36).slice(2, 9);
}
