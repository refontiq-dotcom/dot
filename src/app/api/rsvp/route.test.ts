import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const URL_BASE = 'http://localhost:3000/api/rsvp';

function request(body: unknown, options: { origin?: string | null; contentType?: string } = {}) {
  const headers = new Headers();
  if (options.origin !== null) headers.set('origin', options.origin ?? 'http://localhost:3000');
  headers.set('content-type', options.contentType ?? 'application/json');
  return new NextRequest(URL_BASE, { method: 'POST', headers, body: JSON.stringify(body) });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    guestName: 'Marie Kouassi',
    phone: '0700000000',
    attending: true,
    companions: [],
    website: '',
    ...overrides,
  };
}

beforeEach(() => {
  // Aucune clé Supabase en test : les routes valident d'abord la requête.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/rsvp — inscription simple, sans compte', () => {
  it('refuse une requête sans origine', async () => {
    const response = await POST(request(payload(), { origin: null }));
    expect(response.status).toBe(403);
  });

  it('refuse une origine étrangère', async () => {
    const response = await POST(request(payload(), { origin: 'https://exemple.test' }));
    expect(response.status).toBe(403);
  });

  it('refuse un contenu non JSON', async () => {
    const response = await POST(request(payload(), { contentType: 'text/plain' }));
    expect(response.status).toBe(415);
  });

  it('ignore silencieusement le honeypot', async () => {
    const response = await POST(request(payload({ website: 'spam' })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('refuse un numéro invalide', async () => {
    const response = await POST(request(payload({ phone: '0912345678' })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_phone');
  });

  it('refuse un nom trop court', async () => {
    const response = await POST(request(payload({ guestName: 'A' })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_name');
  });

  it('refuse une présence non renseignée', async () => {
    const response = await POST(request(payload({ attending: 'yes' })));
    expect(response.status).toBe(400);
  });

  it('refuse des accompagnateurs pour une absence', async () => {
    const response = await POST(request(payload({ attending: false, companions: ['Awa Traoré'] })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_companions');
  });

  it('refuse un accompagnateur en double', async () => {
    const response = await POST(request(payload({ companions: ['Awa Traoré', 'TRAORE awa'] })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_companions');
  });

  it('refuse un accompagnateur portant le même nom que l’invité principal', async () => {
    const response = await POST(request(payload({ guestName: 'Marie Kouassi', companions: ['KOUASSI Marie'] })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_companions');
  });

  it('refuse plus de 9 accompagnateurs', async () => {
    const companions = Array.from({ length: 10 }, (_, index) => `Invité ${index + 1}`);
    const response = await POST(request(payload({ companions })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_companions');
  });

  it('ne demande ni compte ni code de modification', async () => {
    const response = await POST(request(payload({ mode: 'update', editCode: '123456' })));
    expect(response.status).toBe(503);
  });

  it('renvoie 503 sans configuration Supabase après validation', async () => {
    const response = await POST(request(payload()));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('unavailable');
  });

  it('accepte les trois formats de numéro ivoirien', async () => {
    for (const phone of ['0700000000', '+2250700000000', '002250700000000']) {
      const response = await POST(request(payload({ phone })));
      expect(response.status).toBe(503);
    }
  });

  it('accepte un groupe complet', async () => {
    const response = await POST(request(payload({ companions: ['Awa Traoré', 'Yao Konan'] })));
    expect(response.status).toBe(503);
  });
});
