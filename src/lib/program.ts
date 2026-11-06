import type { Item } from './content';

/** « 06:00 » → « 6 h 00 ». Renvoie '' si la valeur n'est pas une heure valide. */
export function formatClock(value?: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  return `${hours} h ${match[2]}`;
}

/** « 6 h 00 – 8 h 00 », « 13 h 00 » ou '' selon les heures renseignées. */
export function formatRange(begin?: string, end?: string): string {
  const start = formatClock(begin);
  const finish = formatClock(end);
  if (start && finish && start !== finish) return `${start} – ${finish}`;
  return start || finish;
}

export type ProgramGroup = { phase: string; items: Item[] };

/** Regroupe les étapes consécutives qui ont la même « partie de la journée ». */
export function groupProgram(items: Item[]): ProgramGroup[] {
  const groups: ProgramGroup[] = [];
  for (const item of items) {
    const phase = (item.phase ?? '').trim();
    const last = groups[groups.length - 1];
    if (last && last.phase === phase) last.items.push(item);
    else groups.push({ phase, items: [item] });
  }
  return groups;
}

/** Trie par heure de début ; les étapes sans heure gardent leur place relative. */
export function sortByTime(items: Item[]): Item[] {
  const minutes = (value?: string) => {
    const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => minutes(a.item.timeBegin) - minutes(b.item.timeBegin) || a.index - b.index)
    .map(entry => entry.item);
}
