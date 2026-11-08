import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, NO_STORE } from '@/lib/rsvp-server';

export const runtime = 'nodejs';

function reply(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

async function organizerClient(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || data.user?.email?.toLowerCase() !== 'refontiq@gmail.com') return null;
  return getAdminClient();
}

export async function GET(request: NextRequest) {
  const supabase = await organizerClient(request);
  if (!supabase) return reply({ error: 'Accès réservé aux organisateurs.' }, 403);
  const { data, error } = await supabase
    .from('private_event_details')
    .select('venue, venue_detail, map_url, travel')
    .eq('id', 'main')
    .maybeSingle();
  if (error) return reply({ error: 'Impossible de charger les informations privées.' }, 500);
  return reply({ details: data ?? { venue: '', venue_detail: '', map_url: '', travel: {} } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await organizerClient(request);
  if (!supabase) return reply({ error: 'Accès réservé aux organisateurs.' }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return reply({ error: 'Données invalides.' }, 400); }

  const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
  const venueDetail = typeof body.venueDetail === 'string' ? body.venueDetail.trim() : '';
  const mapUrl = typeof body.mapUrl === 'string' ? body.mapUrl.trim() : '';
  const travel = body.travel && typeof body.travel === 'object' && !Array.isArray(body.travel) ? body.travel : {};
  if (!venue || !venueDetail || !mapUrl) return reply({ error: 'Le lieu, le repère et le lien Google Maps sont obligatoires.' }, 400);
  try {
    const parsed = new URL(mapUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
  } catch { return reply({ error: 'Le lien Google Maps doit commencer par https:// ou http://.' }, 400); }

  const { error } = await supabase.from('private_event_details').upsert({
    id: 'main', venue, venue_detail: venueDetail, map_url: mapUrl, travel, updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) return reply({ error: 'Impossible d’enregistrer les informations privées.' }, 500);
  return reply({ ok: true });
}
