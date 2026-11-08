import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const URL_BASE = 'http://localhost:3000/api/rsvp/lookup';

function request(body: unknown, options: { origin?: string | null; contentType?: string } = {}) {
  const headers = new Headers();
  if (options.origin !== null) headers.set('origin', options.origin ?? 'http://localhost:3000');
  headers.set('content-type', options.contentType ?? 'application/json');
  return new NextRequest(URL_BASE, { method: 'POST', headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/rsvp/lookup — retrouver sa réponse pour la modifier', () => {
  it('refuse une requête sans origine ou d’une origine étrangère', async () => {
    expect((await POST(request({ guestName: 'Marie Kouassi', phone: '0700000000' }, { origin: null }))).status).toBe(403);
    expect((await POST(request({ guestName: 'Marie Kouassi', phone: '0700000000' }, { origin: 'https://exemple.test' }))).status).toBe(403);
  });

  it('refuse un contenu non JSON', async () => {
    expect((await POST(request({}, { contentType: 'text/plain' }))).status).toBe(415);
  });

  it('refuse un numéro invalide', async () => {
    const response = await POST(request({ guestName: 'Marie Kouassi', phone: '0912345678' }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_phone');
  });

  it('accepte le numéro seul comme identifiant de recherche', async () => {
    const response = await POST(request({ phone: '0700000000' }));
    // Le numéro est valide ; la route atteint ensuite le contrôle de configuration Supabase.
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('unavailable');
  });

  it('signale l’indisponibilité du service sans rien révéler', async () => {
    const response = await POST(request({ guestName: 'Marie Kouassi', phone: '0700000000' }));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
