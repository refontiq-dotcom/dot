import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type RsvpPayload = {
  guestName?: unknown;
  attending?: unknown;
  personCount?: unknown;
  website?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).origin !== request.nextUrl.origin) {
    return jsonError('Requête non autorisée.', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Format de requête invalide.', 415);
  }

  let body: RsvpPayload;
  try {
    body = await request.json() as RsvpPayload;
  } catch {
    return jsonError('Données invalides.', 400);
  }

  // Honeypot: quietly accept automated submissions without storing them.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const guestName = typeof body.guestName === 'string' ? body.guestName.trim().replace(/\s+/g, ' ') : '';
  if (guestName.length < 2 || guestName.length > 120) {
    return jsonError('Veuillez saisir votre nom et prénom (2 à 120 caractères).', 400);
  }
  if (typeof body.attending !== 'boolean') {
    return jsonError('Veuillez indiquer si vous serez présent(e).', 400);
  }

  const personCount = body.attending ? body.personCount : 0;
  if (typeof personCount !== 'number' || !Number.isInteger(personCount) || personCount < (body.attending ? 1 : 0) || personCount > 10) {
    return jsonError('Le nombre de participants doit être compris entre 1 et 10.', 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError('Le service de confirmation est momentanément indisponible.', 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.from('rsvp_responses').insert({
    guest_name: guestName,
    person_count: personCount,
    confirmed: body.attending,
  });

  if (error) {
    // Keep database details in server logs, never return them to visitors.
    console.error('Dot RSVP insert failed:', error.message);
    return jsonError('Votre réponse n’a pas pu être enregistrée. Veuillez réessayer.', 500);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
