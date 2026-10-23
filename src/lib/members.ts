import type { Member } from '../shared/types';

export const MEMBER_COLORS = [
  '#4C7DF0', // blue
  '#E2558A', // pink
  '#8B5CF6', // violet
  '#22A06B', // green
  '#F08C2E', // orange
  '#14A3B8', // teal
  '#D9483B', // red
  '#A16207', // mustard
];

export function nextColor(used: Member[]) {
  return MEMBER_COLORS.find((c) => !used.some((m) => m.color === c)) ?? MEMBER_COLORS[used.length % MEMBER_COLORS.length];
}

export function newMemberId() {
  return Math.random().toString(36).slice(2, 9);
}
