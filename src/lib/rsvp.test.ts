import { describe, expect, it } from 'vitest';
import {
  MAX_COMPANIONS,
  cleanCompanionNames,
  cleanPersonName,
  declaredGroupSize,
  formatIvorianPhone,
  groupSize,
  normalizeIvorianPhone,
  normalizeNameKey,
  removedCompanions,
  summarizeGuests,
  validateGuestName,
} from './rsvp';

describe('Téléphone ivoirien (scénarios A, B et I)', () => {
  it.each([
    ['0700000000'],
    ['+2250700000000'],
    ['002250700000000'],
    ['07 00 00 00 00'],
    ['+225 07 00 00 00 00'],
    ['07-00-00-00-00'],
  ])('normalise %s vers +2250700000000', raw => {
    const result = normalizeIvorianPhone(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe('+2250700000000');
      expect(result.display).toBe('+225 07 00 00 00 00');
    }
  });

  it('accepte les préfixes mobiles et fixes prévus', () => {
    for (const prefix of ['01', '05', '07', '21', '22', '23', '25', '27']) {
      expect(normalizeIvorianPhone(`${prefix}12345678`).ok).toBe(true);
    }
  });

  it.each([
    ['', 'vide'],
    ['07000000', 'trop court'],
    ['070000000000', 'trop long'],
    ['0912345678', 'préfixe inconnu'],
    ['+2250912345678', 'préfixe inconnu avec indicatif'],
    ['07 00 00 00 AB', 'lettres'],
    ['+33 6 12 34 56 78', 'numéro étranger'],
  ])('refuse %s (%s)', raw => {
    expect(normalizeIvorianPhone(raw).ok).toBe(false);
  });

  it('formate un numéro normalisé pour l’organisateur', () => {
    expect(formatIvorianPhone('+2250700000000')).toBe('+225 07 00 00 00 00');
  });
});

describe('Noms et doublons potentiels (scénarios B, H)', () => {
  it('nettoie les espaces superflus', () => {
    expect(cleanPersonName('  Marie   Kouassi  ')).toBe('Marie Kouassi');
    expect(cleanPersonName(42)).toBe('');
  });

  it('refuse les noms trop courts ou trop longs', () => {
    expect(validateGuestName('A')).not.toBeNull();
    expect(validateGuestName('A'.repeat(121))).not.toBeNull();
    expect(validateGuestName('Marie Kouassi')).toBeNull();
  });

  it('compare les noms sans casse, accents ni ordre des prénoms', () => {
    const reference = normalizeNameKey('Marie Kouassi');
    expect(normalizeNameKey('KOUASSI Marie')).toBe(reference);
    expect(normalizeNameKey('  kouássi   marie ')).toBe(reference);
    expect(normalizeNameKey('Marie Kouassi')).toBe(reference);
    expect(normalizeNameKey('Marie Kouassi')).not.toBe(normalizeNameKey('Marie Koffi'));
  });

  it('ne produit pas de clé vide pour un nom uniquement composé de symboles', () => {
    expect(normalizeNameKey('---')).toBe('');
  });
});

describe('Accompagnateurs (scénarios D, E, F, G)', () => {
  it('accepte zéro accompagnateur', () => {
    expect(cleanCompanionNames([], true)).toEqual({ ok: true, names: [], keys: [] });
    expect(cleanCompanionNames(undefined, true)).toEqual({ ok: true, names: [], keys: [] });
  });

  it('accepte deux accompagnateurs et compte trois personnes', () => {
    const result = cleanCompanionNames(['Awa Traoré', 'Yao Koffi'], true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.names).toEqual(['Awa Traoré', 'Yao Koffi']);
      expect(groupSize(true, result.names.length)).toBe(3);
    }
  });

  it('accepte l’ajout d’un troisième accompagnateur', () => {
    const result = cleanCompanionNames(['Awa Traoré', 'Yao Koffi', 'Koffi N’Guessan'], true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(groupSize(true, result.names.length)).toBe(4);
  });

  it('refuse deux fois la même personne, même écrite différemment', () => {
    const result = cleanCompanionNames(['Awa Traoré', 'TRAORE awa'], true);
    expect(result.ok).toBe(false);
  });

  it('refuse un nom vide, trop long ou une liste trop grande', () => {
    expect(cleanCompanionNames([''], true).ok).toBe(false);
    expect(cleanCompanionNames(['A'.repeat(121)], true).ok).toBe(false);
    expect(cleanCompanionNames(Array.from({ length: MAX_COMPANIONS + 1 }, (_, i) => `Invité ${i}`), true).ok).toBe(false);
  });

  it('refuse tout accompagnateur pour une absence', () => {
    expect(cleanCompanionNames(['Awa Traoré'], false).ok).toBe(false);
    expect(cleanCompanionNames([], false)).toEqual({ ok: true, names: [], keys: [] });
    expect(groupSize(false, 2)).toBe(0);
  });

  it('identifie les accompagnateurs retirés lors d’une réduction', () => {
    expect(removedCompanions(['Awa Traoré', 'Yao Koffi', 'Koffi N’Guessan'], 1)).toEqual(['Yao Koffi', 'Koffi N’Guessan']);
    expect(removedCompanions(['Awa Traoré'], 1)).toEqual([]);
    expect(removedCompanions(['Awa Traoré', '  '], 1)).toEqual([]);
  });
});

describe('Comptage et statistiques (scénarios D, G, J)', () => {
  it('ne compte pas deux fois principal + accompagnateurs', () => {
    const expected = summarizeGuests([
      { confirmed: true, person_count: 3, rsvp_companions: [{ id: 'a' }, { id: 'b' }] },
    ]);
    expect(expected.expectedPeople).toBe(3);
    expect(expected.companions).toBe(2);
  });

  it('conserve le comptage historique quand les accompagnateurs ne sont pas nommés', () => {
    expect(declaredGroupSize(4, 0, true)).toBe(4);
    expect(summarizeGuests([{ confirmed: true, person_count: 4, rsvp_companions: [] }]).expectedPeople).toBe(4);
  });

  it('exclut totalement les groupes déclinés', () => {
    expect(declaredGroupSize(5, 4, false)).toBe(0);
    const summary = summarizeGuests([
      { confirmed: true, person_count: 2, rsvp_companions: [{ id: 'a' }] },
      { confirmed: false, person_count: 0, rsvp_companions: [] },
      { confirmed: false, person_count: 6, rsvp_companions: [{ id: 'b' }] },
    ]);
    expect(summary).toEqual({ responses: 3, attending: 1, declined: 2, companions: 1, expectedPeople: 2 });
  });

  it('agrège un groupe mixte sans double comptage', () => {
    const summary = summarizeGuests([
      { confirmed: true, person_count: 3, rsvp_companions: [{ id: 'a' }, { id: 'b' }] },
      { confirmed: true, person_count: 1, rsvp_companions: [] },
      { confirmed: false, person_count: 0, rsvp_companions: [] },
    ]);
    expect(summary.attending).toBe(2);
    expect(summary.declined).toBe(1);
    expect(summary.companions).toBe(2);
    expect(summary.expectedPeople).toBe(4);
  });
});
