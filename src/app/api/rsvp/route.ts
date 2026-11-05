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
  RATE_LIMITS,
  clientIp,
  detectDuplicateNames,
  getAdminClient,
  hashIp,
  isRateLimited,
  recordRateEvent,
} from '@/lib/rsvp-server';

export const runtime = 'nodejs';

type RsvpPayload = {
  guestName?: unknown;
  phone?: unknown;
  attending?: unknown;
  companions?: unknown;
  website?: unknown;
};

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function jsonError(message: string, status: number, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

function requestOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
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
  if (await isRateLimited(supabase, { ipHash, windowMinutes: 60, limit: RATE_LIMITS.savePerHourPerIp })) {
    return jsonError('Trop de tentatives depuis cette connexion. Patientez quelques minutes.', 429, 'rate_limited');
  }

  // Même numéro = même inscription : le serveur met à jour la réponse existante.
  const nameKeys = [normalizeNameKey(guestName), ...companions.keys].filter(Boolean);
  const possibleDuplicate = await detectDuplicateNames(supabase, nameKeys, phone.normalized);

  const { data, error } = await supabase.rpc('save_rsvp', {
    p_phone: phone.display,
    p_phone_normalized: phone.normalized,
    p_guest_name: guestName,
    p_attending: attending,
    p_companion_names: companions.names,
    p_companion_name_keys: companions.keys,
  });

  if (error) {
    const message = error.message ?? '';
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

  await recordRateEvent(supabase, ipHash);

  const saved = Array.isArray(data) ? data[0] : data;
  const companionCount = companions.names.length;
  const created = saved?.saved_created !== false;

  return json(
    {
      ok: true,
      updated: !created,
      guestName,
      attending,
      companionCount,
      personCount: groupSize(attending, companionCount),
      possibleDuplicate,
      updatedAt: saved?.saved_updated_at ?? new Date().toISOString(),
    },
    created ? 201 : 200,
  );
}
