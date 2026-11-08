import { NextRequest, NextResponse } from 'next/server';
import { normalizeIvorianPhone } from '@/lib/rsvp';
import {
  NO_STORE,
  RATE_LIMITS,
  clientIp,
  getAdminClient,
  hashIp,
  isRateLimited,
  recordRateEvent,
  requestOriginAllowed,
} from '@/lib/rsvp-server';

export const runtime = 'nodejs';

type LookupPayload = { phone?: unknown };

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function jsonError(message: string, status: number, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

const NOT_FOUND = 'Aucune réponse ne correspond à ce numéro. Vérifiez le numéro utilisé lors de votre inscription.';

/**
 * Retrouve une réponse à partir du numéro communiqué lors de l'inscription.
 * Si plusieurs réponses partagent le même numéro, aucune donnée n'est révélée.
 */
export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return jsonError('Requête non autorisée.', 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Format de requête invalide.', 415);
  }

  let body: LookupPayload;
  try {
    body = (await request.json()) as LookupPayload;
  } catch {
    return jsonError('Données invalides.', 400);
  }

  const phone = normalizeIvorianPhone(body.phone);
  if (!phone.ok) return jsonError(phone.error, 400, 'invalid_phone');

  const supabase = getAdminClient();
  if (!supabase) return jsonError('Le service de confirmation est momentanément indisponible.', 503, 'unavailable');

  const ipHash = hashIp(clientIp(request.headers));
  if (await isRateLimited(supabase, { ipHash, windowMinutes: 60, limit: RATE_LIMITS.lookupPerHourPerIp })) {
    return jsonError('Trop de tentatives depuis cette connexion. Patientez quelques minutes.', 429, 'rate_limited');
  }
  await recordRateEvent(supabase, ipHash);

  const { data: rows, error } = await supabase
    .from('rsvp_responses')
    .select('id, guest_name, confirmed, max_companions, attendance_status')
    .eq('phone_normalized', phone.normalized)
    .limit(2);
  if (error) {
    console.error('Dot RSVP lookup failed:', error.message);
    return jsonError('Votre réponse n’a pas pu être retrouvée. Veuillez réessayer.', 500);
  }
  if (!rows?.length) return jsonError(NOT_FOUND, 404, 'not_found');
  if (rows.length > 1) {
    return jsonError('Plusieurs réponses sont associées à ce numéro. Contactez les familles pour retrouver la bonne réponse.', 409, 'multiple_responses');
  }

  const row = rows[0];
  const { data: companionRows, error: companionError } = await supabase
    .from('rsvp_companions')
    .select('full_name, position')
    .eq('rsvp_id', row.id)
    .order('position', { ascending: true });
  if (companionError) {
    console.error('Dot RSVP companions lookup failed:', companionError.message);
    return jsonError('Votre réponse n’a pas pu être retrouvée. Veuillez réessayer.', 500);
  }

  const status = row.attendance_status ?? (row.confirmed ? 'accepted' : 'declined');
  let venueDetails: Record<string, unknown> | null = null;
  if (status === 'accepted') {
    const { data: details, error: detailsError } = await supabase
      .from('private_event_details')
      .select('venue, venue_detail, map_url, travel')
      .eq('id', 'main')
      .maybeSingle();
    if (detailsError) console.error('Dot private venue lookup failed:', detailsError.message);
    else if (details) venueDetails = details as Record<string, unknown>;
  }

  return json({
    ok: true,
    guestName: row.guest_name,
    attending: status !== 'declined',
    companions: (companionRows ?? []).map(c => String(c.full_name)),
    companionCount: (companionRows ?? []).length,
    personCount: status === 'declined' ? 0 : 1 + (companionRows ?? []).length,
    maxCompanions: Number(row.max_companions ?? 0),
    status,
    ...(venueDetails ? { venueDetails } : {}),
  });
}
