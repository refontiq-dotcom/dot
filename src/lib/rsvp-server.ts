// Utilitaires serveur uniquement : ne jamais importer ce module depuis un composant client.
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeNameKey } from '@/lib/rsvp';

export const RATE_LIMITS = {
  savePerHourPerIp: 30,
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

/** Adresse IP derrière le proxy Vercel, sans la stocker en clair. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || headers.get('x-real-ip')?.trim() || 'unknown';
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
    // Ne jamais bloquer un invité à cause d'un incident de mesure.
    console.error('Dot RSVP rate limit read failed:', error.message);
    return false;
  }
  return (count ?? 0) >= input.limit;
}

export async function recordRateEvent(supabase: SupabaseClient, ipHash: string): Promise<void> {
  const { error } = await supabase.from('rsvp_rate_events').insert({ ip_hash: ipHash });
  if (error) console.error('Dot RSVP rate event insert failed:', error.message);
}

/**
 * Signale un nom déjà présent dans un autre groupe.
 * Simple avertissement : aucune fusion, aucun blocage. En cas d'erreur, on n'avertit pas.
 */
export async function detectDuplicateNames(
  supabase: SupabaseClient,
  keys: string[],
  excludePhone: string,
): Promise<boolean> {
  if (keys.length === 0) return false;
  const targets = new Set(keys);

  const [principals, companions] = await Promise.all([
    supabase.from('rsvp_responses').select('guest_name, phone_normalized'),
    supabase.from('rsvp_companions').select('name_normalized'),
  ]);

  if (principals.error || companions.error) {
    console.error('Dot RSVP duplicate check failed:', principals.error?.message ?? companions.error?.message);
    return false;
  }

  for (const row of (principals.data ?? []) as { guest_name: string; phone_normalized: string | null }[]) {
    if (row.phone_normalized && row.phone_normalized === excludePhone) continue;
    if (targets.has(normalizeNameKey(row.guest_name))) return true;
  }

  for (const row of (companions.data ?? []) as { name_normalized: string }[]) {
    if (targets.has(row.name_normalized)) return true;
  }

  return false;
}
