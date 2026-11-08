// Utilitaires serveur uniquement : ne jamais importer ce module depuis un composant client.
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { namesMayReferToSamePerson } from '@/lib/rsvp';

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
 * Détecte un nom déjà présent dans un autre groupe, y compris les noms abrégés,
 * les accents et les variantes courantes. Les compagnons du dossier en cours
 * de modification sont exclus. La base applique la même règle en dernier recours.
 */
export async function detectDuplicateNames(
  supabase: SupabaseClient,
  names: string[],
  excludePhone: string,
): Promise<boolean> {
  if (names.length === 0) return false;

  const [principals, companions] = await Promise.all([
    supabase.from('rsvp_responses').select('id, guest_name, phone_normalized'),
    supabase.from('rsvp_companions').select('rsvp_id, full_name'),
  ]);

  if (principals.error || companions.error) {
    console.error('Dot RSVP duplicate check failed:', principals.error?.message ?? companions.error?.message);
    return false;
  }

  const principalRows = (principals.data ?? []) as { id: string; guest_name: string; phone_normalized: string | null }[];
  const excludedIds = new Set(principalRows.filter(row => row.phone_normalized === excludePhone).map(row => row.id));
  const existingNames = [
    ...principalRows.filter(row => !excludedIds.has(row.id)).map(row => row.guest_name),
    ...((companions.data ?? []) as { rsvp_id: string; full_name: string }[])
      .filter(row => !excludedIds.has(row.rsvp_id))
      .map(row => row.full_name),
  ];

  return names.some(incoming => existingNames.some(existing => namesMayReferToSamePerson(incoming, existing)));
}
