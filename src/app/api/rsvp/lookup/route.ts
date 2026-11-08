import { NextRequest, NextResponse } from 'next/server';
import { normalizeIvorianPhone, normalizeNameKey, validateGuestName } from '@/lib/rsvp';
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

type LookupPayload = { guestName?: unknown; phone?: unknown };

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function jsonError(message: string, status: number, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

const NOT_FOUND = 'Nous ne trouvons pas de réponse avec ce nom et ce numéro. Vérifiez-les, ou touchez « Envoyer ma réponse » si c’est votre première réponse.';

/**
 * Retrouve la réponse d'un invité pour la modifier.
 * Le numéro ET le nom doivent correspondre : sinon rien n'est révélé.
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
  const nameError = validateGuestName(body.guestName);
  if (nameError) return jsonError(nameError, 400, 'invalid_name');
  const nameKey = normalizeNameKey(String(body.guestName));

  const supabase = getAdminClient();
  if (!supabase) return jsonError('Le service de confirmation est momentanément indisponible.', 503, 'unavailable');

  const ipHash = hashIp(clientIp(request.headers));
  if (await isRateLimited(supabase, { ipHash, windowMinutes: 60, limit: RATE_LIMITS.savePerHourPerIp })) {
    return jsonError('Trop de tentatives depuis cette connexion. Patientez quelques minutes.', 429, 'rate_limited');
  }
  await recordRateEvent(supabase, ipHash);

  const { data: row, error } = await supabase
    .from('rsvp_responses')
    .select('id, guest_name, confirmed, max_companions, attendance_status')
    .eq('phone_normalized', phone.normalized)
    .maybeSingle();
  if (error) {
    console.error('Dot RSVP lookup failed:', error.message);
    return jsonError('Votre réponse n’a pas pu être retrouvée. Veuillez réessayer.', 500);
  }
  if (!row || normalizeNameKey(String(row.guest_name)) !== nameKey) {
    return jsonError(NOT_FOUND, 404, 'not_found');
  }

  const { data: companionRows, error: companionError } = await supabase
    .from('rsvp_companions')
    .select('full_name, position')
    .eq('rsvp_id', row.id)
    .order('position', { ascending: true });
  if (companionError) {
    console.error('Dot RSVP companions lookup failed:', companionError.message);
    return jsonError('Votre réponse n’a pas pu être retrouvée. Veuillez réessayer.', 500);
  }

  let venueDetails: Record<string, unknown> | null = null;
  if (row.attendance_status === 'accepted') {
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
    attending: row.attendance_status ? row.attendance_status !== 'declined' : row.confirmed === true,
    companions: (companionRows ?? []).map(c => String(c.full_name)),
    maxCompanions: Number(row.max_companions ?? 0),
    status: row.attendance_status ?? (row.confirmed ? 'accepted' : 'declined'),
    ...(venueDetails ? { venueDetails } : {}),
  });
}
