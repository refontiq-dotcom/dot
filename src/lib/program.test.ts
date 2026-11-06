import { describe, expect, it } from 'vitest';
import { formatClock, formatRange, groupProgram, sortByTime } from './program';

const step = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, detail: '', confirmed: true, ...extra });

describe('formatClock', () => {
  it('met les heures au format français', () => {
    expect(formatClock('06:00')).toBe('6 h 00');
    expect(formatClock('13:30')).toBe('13 h 30');
  });
  it('refuse les valeurs invalides', () => {
    expect(formatClock('')).toBe('');
    expect(formatClock(undefined)).toBe('');
    expect(formatClock('25:00')).toBe('');
    expect(formatClock('abc')).toBe('');
  });
});

describe('formatRange', () => {
  it('affiche une plage, une heure seule ou rien', () => {
    expect(formatRange('09:00', '11:00')).toBe('9 h 00 – 11 h 00');
    expect(formatRange('13:00', '')).toBe('13 h 00');
    expect(formatRange('13:00', '13:00')).toBe('13 h 00');
    expect(formatRange('', '')).toBe('');
  });
});

describe('groupProgram', () => {
  it('regroupe les étapes consécutives de même partie', () => {
    const groups = groupProgram([step('a', { phase: 'Matin' }), step('b', { phase: 'Matin' }), step('c', { phase: 'Fête' }), step('d', { phase: 'Matin' })]);
    expect(groups.map(g => [g.phase, g.items.length])).toEqual([['Matin', 2], ['Fête', 1], ['Matin', 1]]);
  });
  it('gère l’absence de partie', () => {
    expect(groupProgram([step('a'), step('b')])).toEqual([{ phase: '', items: [step('a'), step('b')] }]);
  });
});

describe('sortByTime', () => {
  it('trie par heure et place les étapes sans heure à la fin', () => {
    const sorted = sortByTime([step('c', { timeBegin: '15:00' }), step('x'), step('a', { timeBegin: '06:00' }), step('b', { timeBegin: '09:00' })]);
    expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c', 'x']);
  });
});
