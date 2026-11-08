// Utilitaires serveur uniquement : ne jamais importer ce module depuis un composant client.
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const RATE_LIMITS = {
  savePerHourPerIp: 30,
  lookupPerHourPerIp: 10,
} as const;

export const NO_STORE = { 'Cache-Control': 'no-store' };

/** Les requêtes doivent venir du site lui-même (même origine). */
export function requestOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

/** Client service_role : toutes les écritures RSVP passent par lui. */
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/** Adresse IP transmise par le proxy ; seul son hash est conservé en base. */
export function clientIp(headers: Headers): string {
  return headers.get('x-real-ip')?.trim()
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

type RateLimitInput = {
  ipHash: string;
  windowMinutes: number;
  limit: number;
};

/**
 * Enregistre et vérifie une tentative dans une seule transaction SQL.
 * La fonction PostgreSQL sérialise les requêtes d'une même IP pour éviter
 * qu'un grand nombre de requêtes simultanées contourne la limite.
 */
export async function consumeRateLimit(supabase: SupabaseClient, input: RateLimitInput): Promise<boolean> {
  const { data, error } = await supabase.rpc('consume_rsvp_rate_limit', {
    p_ip_hash: input.ipHash,
    p_window_minutes: input.windowMinutes,
    p_limit: input.limit,
  });

  if (error) {
    console.error('Dot RSVP rate limit failed:', error.message);
    throw new Error('RSVP_RATE_LIMIT_UNAVAILABLE');
  }

  return data === true;
}
