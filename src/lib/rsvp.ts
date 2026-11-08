// Logique RSVP partagée entre le navigateur et le serveur.
// Aucun secret, aucune dépendance Node : ce module doit rester importable côté client.

export const MAX_COMPANIONS = 2;
export const MAX_GROUP_SIZE = MAX_COMPANIONS + 1;

// Préfixes ivoiriens à 10 chiffres : mobiles (01, 05, 07) et fixes (21, 22, 23, 25, 27).
const IVORIAN_PREFIXES = new Set(['01', '05', '07', '21', '22', '23', '25', '27']);

export type PhoneResult =
  | { ok: true; normalized: string; display: string }
  | { ok: false; error: string };

/** Formate un numéro normalisé (+225XXXXXXXXXX) pour l'affichage organisateur. */
export function formatIvorianPhone(normalized: string): string {
  const digits = normalized.replace(/\D/g, '');
  const local = digits.startsWith('225') ? digits.slice(3) : digits;
  if (local.length !== 10) return normalized;
  return `+225 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
}

/**
 * Accepte 0700000000, +2250700000000, 002250700000000 (avec espaces, points, tirets)
 * et renvoie toujours +225XXXXXXXXXX.
 */
export function normalizeIvorianPhone(raw: unknown): PhoneResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Veuillez saisir votre numéro de téléphone.' };
  }

  const compact = raw.trim().replace(/[\s.\-()/]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    return { ok: false, error: 'Le numéro ne doit contenir que des chiffres (et éventuellement +225).' };
  }

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('225') && digits.length > 10) digits = digits.slice(3);

  if (!/^\d{10}$/.test(digits)) {
    return { ok: false, error: 'Le numéro doit comporter 10 chiffres, par exemple 07 00 00 00 00.' };
  }
  if (!IVORIAN_PREFIXES.has(digits.slice(0, 2))) {
    return { ok: false, error: 'Ce numéro ne semble pas être un numéro ivoirien valide (01, 05, 07, 21, 22, 23, 25 ou 27).' };
  }

  const normalized = `+225${digits}`;
  return { ok: true, normalized, display: formatIvorianPhone(normalized) };
}

/** Nettoie un nom saisi (espaces multiples, espaces de bord). */
export function cleanPersonName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** Vérifie un nom d'invité principal. Renvoie null si le nom est valide. */
export function validateGuestName(value: unknown): string | null {
  const name = cleanPersonName(value);
  if (name.length < 2 || name.length > 120) {
    return 'Veuillez saisir votre nom et prénom (2 à 120 caractères).';
  }
  if (!/\p{L}/u.test(name)) {
    return 'Le nom doit contenir au moins une lettre.';
  }
  return null;
}

/**
 * Clé de comparaison insensible à la casse, aux accents et à l'ordre des prénoms.
 * Sert uniquement à signaler un doublon potentiel : jamais à fusionner.
 */
export function normalizeNameKey(value: unknown): string {
  const name = cleanPersonName(value);
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}


/**
 * Compare deux noms pour repérer une probable même personne malgré les accents,
 * les particules de nom (Epse/Épouse) et les prénoms ou noms supplémentaires.
 * Il faut au moins deux mots distinctifs communs et 75 % des mots du nom le plus
 * court. Cette règle sert à bloquer une inscription suspecte, pas à fusionner
 * des dossiers : l'invité est invité à contacter les familles.
 */
export function normalizedNameTokens(value: unknown): string[] {
  const ignored = new Set(['epse', 'epouse', 'mme', 'mr', 'madame', 'monsieur', 'de', 'du', 'des', 'le', 'la', 'les']);
  const normalized = cleanPersonName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  return [...new Set(normalized.split(' ').filter(token => token.length > 1 && !ignored.has(token)))];
}

export function namesMayReferToSamePerson(left: unknown, right: unknown): boolean {
  const leftTokens = normalizedNameTokens(left);
  const rightTokens = normalizedNameTokens(right);
  const shortestLength = Math.min(leftTokens.length, rightTokens.length);
  if (shortestLength < 2) return false;
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter(token => rightSet.has(token)).length;
  return shared >= 2 && shared * 4 >= shortestLength * 3;
}

export type CompanionValidation =
  | { ok: true; names: string[]; keys: string[] }
  | { ok: false; error: string };

/** Valide et normalise la liste des accompagnateurs (jamais de numéro pour eux). */
export function cleanCompanionNames(input: unknown, attending: boolean): CompanionValidation {
  if (!attending) {
    const length = Array.isArray(input) ? input.filter(item => cleanPersonName(item)).length : 0;
    if (length > 0) {
      return { ok: false, error: 'Aucun proche ne peut être indiqué pour une absence.' };
    }
    return { ok: true, names: [], keys: [] };
  }

  if (input === undefined || input === null) return { ok: true, names: [], keys: [] };
  if (!Array.isArray(input)) {
    return { ok: false, error: 'La liste des proches est invalide.' };
  }
  if (input.length > MAX_COMPANIONS) {
    return { ok: false, error: `Vous pouvez ajouter au maximum ${MAX_COMPANIONS} proches.` };
  }

  const names: string[] = [];
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    const name = cleanPersonName(item);
    if (name.length < 2 || name.length > 120) {
      return { ok: false, error: 'Chaque proche doit avoir un nom et prénom (2 à 120 caractères).' };
    }
    if (!/\p{L}/u.test(name)) {
      return { ok: false, error: 'Le nom de chaque proche doit contenir au moins une lettre.' };
    }
    const key = normalizeNameKey(name);
    if (!key) {
      return { ok: false, error: 'Le nom d’un proche est invalide.' };
    }
    if (seen.has(key)) {
      return { ok: false, error: 'Le même proche est indiqué deux fois.' };
    }
    seen.add(key);
    names.push(name);
    keys.push(key);
  }

  return { ok: true, names, keys };
}

/** Nombre de personnes du groupe : le principal + ses accompagnateurs. */
export function groupSize(attending: boolean, companionCount: number): number {
  if (!attending) return 0;
  return 1 + Math.max(0, Math.min(MAX_COMPANIONS, Math.floor(companionCount) || 0));
}

/**
 * Taille d'un groupe en tenant compte des réponses historiques, où `person_count`
 * comptait déjà les accompagnateurs sans les nommer. Aucune donnée n'est inventée.
 */
export function declaredGroupSize(personCount: number | null | undefined, companionCount: number, attending: boolean): number {
  if (!attending) return 0;
  const legacy = typeof personCount === 'number' && Number.isFinite(personCount) ? Math.max(0, Math.floor(personCount)) : 0;
  return Math.max(legacy, groupSize(true, companionCount));
}

export type StatGuest = {
  confirmed: boolean;
  person_count: number;
  rsvp_companions?: { id: string }[] | null;
};

export type GuestSummary = {
  responses: number;
  attending: number;
  declined: number;
  companions: number;
  expectedPeople: number;
};

/** Agrège les statistiques sans double comptage et sans les groupes déclinés. */
export function summarizeGuests(guests: StatGuest[]): GuestSummary {
  let attending = 0;
  let declined = 0;
  let companions = 0;
  let expectedPeople = 0;

  for (const guest of guests) {
    const companionCount = guest.rsvp_companions?.length ?? 0;
    if (guest.confirmed) {
      attending += 1;
      companions += companionCount;
      expectedPeople += declaredGroupSize(guest.person_count, companionCount, true);
    } else {
      declined += 1;
    }
  }

  return { responses: guests.length, attending, declined, companions, expectedPeople };
}

/** Noms qui seraient retirés si le nombre d'accompagnateurs passait de `previous` à `next`. */
export function removedCompanions(previous: string[], nextCount: number): string[] {
  if (nextCount >= previous.length) return [];
  return previous.slice(Math.max(0, nextCount)).map(name => cleanPersonName(name)).filter(Boolean);
}

