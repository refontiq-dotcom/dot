import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/rsvp-server';
import { cleanPersonName, normalizeIvorianPhone, normalizeNameKey } from '@/lib/rsvp';
import { isAllowedPushEndpoint, pushOriginAllowed, PUSH_NO_STORE } from '@/lib/push-server';

export const runtime = 'nodejs';

function reply(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: PUSH_NO_STORE });
}

export async function GET() {
  const key = process.env.WEB_PUSH_PUBLIC_KEY;
  if (!key) return reply({ error: 'Les notifications ne sont pas encore configurées.' }, 503);
  return reply({ publicKey: key });
}

export async function POST(request: NextRequest) {
  if (!pushOriginAllowed(request)) return reply({ error: 'Requête non autorisée.' }, 403);
  const supabase = getAdminClient();
  if (!supabase) return reply({ error: 'Service momentanément indisponible.' }, 503);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return reply({ error: 'Données invalides.' }, 400); }

  const guestName = cleanPersonName(body.guestName);
  const phone = normalizeIvorianPhone(body.phone);
  const subscription = body.subscription as Record<string, unknown> | undefined;
  const keys = subscription?.keys as Record<string, unknown> | undefined;
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  const p256dh = typeof keys?.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys?.auth === 'string' ? keys.auth : '';
  if (guestName.length < 2 || guestName.length > 120 || !phone.ok || !isAllowedPushEndpoint(endpoint) || !p256dh || !auth) {
    return reply({ error: 'Informations de notification invalides.' }, 400);
  }

  const { data: guests, error: lookupError } = await supabase
    .from('rsvp_responses')
    .select('id, guest_name, attendance_status')
    .eq('phone_normalized', phone.normalized)
    .limit(3);
  if (lookupError) return reply({ error: 'Impossible de vérifier votre invitation.' }, 500);
  const guest = (guests ?? []).find(item =>
    item.attendance_status === 'accepted' && normalizeNameKey(item.guest_name) === normalizeNameKey(guestName)
  );
  if (!guest) return reply({ error: 'Retrouvez votre inscription avec le même nom et le même numéro, puis confirmez votre présence avant d’activer les notifications.' }, 403);

  const expirationTime = typeof subscription?.expirationTime === 'number' ? subscription.expirationTime : null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
  const { error } = await supabase.from('push_subscriptions').upsert({
    rsvp_id: guest.id, endpoint, p256dh, auth,
    expiration_time: expirationTime, user_agent: userAgent, updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error('Dot push subscription save failed:', error.message);
    return reply({ error: 'Impossible d’enregistrer cet appareil. Réessayez.' }, 500);
  }
  return reply({ ok: true });
}
