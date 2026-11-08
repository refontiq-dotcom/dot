import { NextRequest, NextResponse } from 'next/server';
import {
  cleanCompanionNames,
  cleanPersonName,
  groupSize,
  normalizeIvorianPhone,
  normalizeNameKey,
  validateGuestName,
} from '@/lib/rsvp';
import {
  NO_STORE,
  RATE_LIMITS,
  clientIp,
  getAdminClient,
  hashIp,
  consumeRateLimit,
  requestOriginAllowed,
} from '@/lib/rsvp-server';

export const runtime = 'nodejs';

type RsvpPayload = {
  guestName?: unknown;
  phone?: unknown;
  attending?: unknown;
  companions?: unknown;
  website?: unknown;
  mode?: unknown;
};

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function jsonError(message: string, status: number, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) {
    return jsonError('Requête non autorisée.', 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Format de requête invalide.', 415);
  }

  let body: RsvpPayload;
  try {
    body = (await request.json()) as RsvpPayload;
  } catch {
    return jsonError('Données invalides.', 400);
  }

  // Honeypot : on accepte silencieusement sans rien enregistrer.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return json({ ok: true });
  }

  const phone = normalizeIvorianPhone(body.phone);
  if (!phone.ok) return jsonError(phone.error, 400, 'invalid_phone');

  const guestNameError = validateGuestName(body.guestName);
  if (guestNameError) return jsonError(guestNameError, 400, 'invalid_name');
  const guestName = cleanPersonName(body.guestName);

  if (typeof body.attending !== 'boolean') {
    return jsonError('Veuillez indiquer si vous serez présent(e).', 400, 'invalid_attendance');
  }
  const attending = body.attending;

  const companions = cleanCompanionNames(body.companions, attending);
  if (!companions.ok) return jsonError(companions.error, 400, 'invalid_companions');

  const guestKey = normalizeNameKey(guestName);
  if (guestKey && companions.keys.includes(guestKey)) {
    return jsonError('Un proche porte le même nom que vous. Corrigez le formulaire.', 400, 'invalid_companions');
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return jsonError('Le service de confirmation est momentanément indisponible.', 503, 'unavailable');
  }

  const ipHash = hashIp(clientIp(request.headers));
  try {
    if (await consumeRateLimit(supabase, { ipHash, windowMinutes: 60, limit: RATE_LIMITS.savePerHourPerIp })) {
      return jsonError('Trop de tentatives depuis cette connexion. Patientez quelques minutes.', 429, 'rate_limited');
    }
  } catch {
    return jsonError('Le service est momentanément indisponible. Veuillez réessayer plus tard.', 503, 'rate_limit_unavailable');
  }

  // Le téléphone est le seul identifiant demandé pour retrouver et modifier une réponse.
  const updating = body.mode === 'update';
  if (updating) {
    const { data: existing, error: lookupError } = await supabase
      .from('rsvp_responses')
      .select('id')
      .eq('phone_normalized', phone.normalized)
      .limit(2);
    if (lookupError) {
      console.error('Dot RSVP update lookup failed:', lookupError.message);
      return jsonError('Votre réponse n’a pas pu être vérifiée. Veuillez réessayer.', 500);
    }
    if (!existing?.length) {
      return jsonError('Aucune réponse ne correspond à ce numéro.', 404, 'not_found');
    }
    if (existing.length > 1) {
      return jsonError('Plusieurs réponses sont associées à ce numéro. Contactez les familles pour retrouver la bonne réponse.', 409, 'multiple_responses');
    }
  }

  // Le contrôle atomique des noms similaires est effectué dans save_rsvp.

  const { data, error } = await supabase.rpc('save_rsvp', {
    p_phone: phone.display,
    p_phone_normalized: phone.normalized,
    p_guest_name: guestName,
    p_attending: attending,
    p_companion_names: companions.names,
    p_companion_name_keys: companions.keys,
    p_allow_update: updating,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('possible_duplicate_name')) {
      return jsonError(
        'Une inscription avec un nom très proche existe déjà. Pour éviter un doublon, contactez les familles avant de réessayer.',
        409,
        'possible_duplicate_name',
      );
    }
    if (message.includes('already_registered')) {
      return jsonError('Vous êtes déjà sur la liste des invités. Pour changer votre réponse, touchez « Modifier ma réponse ».', 409, 'already_registered');
    }
    if (message.includes('companions_limit')) {
      return jsonError('Vous ne pouvez pas ajouter de proches en plus de ceux déjà indiqués. Pour une demande particulière, contactez les familles.', 409, 'companions_limit');
    }
    if (message.includes('duplicate_companion')) {
      return jsonError('Le même proche est indiqué deux fois.', 400, 'invalid_companions');
    }
    if (message.includes('companions_without_attendance')) {
      return jsonError('Aucun proche ne peut être indiqué pour une absence.', 400, 'invalid_companions');
    }
    if (message.includes('invalid_')) {
      return jsonError('Les informations transmises sont incomplètes ou invalides.', 400);
    }
    console.error('Dot RSVP save failed:', message);
    return jsonError('Votre réponse n’a pas pu être enregistrée. Veuillez réessayer.', 500);
  }

  const saved = Array.isArray(data) ? data[0] : data;
  const companionCount = companions.names.length;
  const created = saved?.saved_created !== false;
  const status = saved?.saved_status === 'accepted' ? 'accepted'
    : saved?.saved_status === 'waitlisted' ? 'waitlisted'
    : saved?.saved_status === 'declined' ? 'declined'
    : 'review';
  let venueDetails: Record<string, unknown> | null = null;
  if (status === 'accepted') {
    const { data: details, error: detailsError } = await supabase
      .from('private_event_details')
      .select('venue, venue_detail, map_url, travel')
      .eq('id', 'main')
      .maybeSingle();
    if (detailsError) console.error('Dot private venue read failed:', detailsError.message);
    else if (details) venueDetails = details as Record<string, unknown>;
  }

  return json(
    {
      ok: true,
      updated: !created,
      guestName,
      attending,
      companionCount,
      personCount: groupSize(attending, companionCount),
      possibleDuplicate: status === 'review',
      status,
      ...(venueDetails ? { venueDetails } : {}),
      updatedAt: saved?.saved_updated_at ?? new Date().toISOString(),
    },
    created ? 201 : 200,
  );
}
