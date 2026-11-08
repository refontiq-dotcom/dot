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

/** Compte les enregistrements récents ; true si la limite est atteinte. */
export async function isRateLimited(supabase: SupabaseClient, input: RateLimitInput): Promise<boolean> {
  const since = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();
  const { count, error } = await supabase
    .from('rsvp_rate_events')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', input.ipHash)
    .gte('created_at', since);

  if (error) {
    console.error('Dot RSVP rate limit read failed:', error.message);
    throw new Error('RSVP_RATE_LIMIT_UNAVAILABLE');
  }
  return (count ?? 0) >= input.limit;
}

export async function recordRateEvent(supabase: SupabaseClient, ipHash: string): Promise<void> {
  const { error } = await supabase.from('rsvp_rate_events').insert({ ip_hash: ipHash });
  if (error) {
    console.error('Dot RSVP rate event insert failed:', error.message);
    throw new Error('RSVP_RATE_LIMIT_UNAVAILABLE');
  }
}

