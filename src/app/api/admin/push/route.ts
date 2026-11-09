import { NextRequest, NextResponse } from 'next/server';
import { organizerPushClient, PUSH_NO_STORE, pushConfigured, sendWebPush } from '@/lib/push-server';

export const runtime = 'nodejs';

function reply(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: PUSH_NO_STORE });
}

export async function GET(request: NextRequest) {
  const supabase = await organizerPushClient(request);
  if (!supabase) return reply({ error: 'Accès réservé aux organisateurs.' }, 403);
  const { data: accepted, error: guestsError } = await supabase
    .from('rsvp_responses').select('id').eq('attendance_status', 'accepted');
  if (guestsError) return reply({ error: 'Impossible de vérifier les invitations confirmées.' }, 500);
  const acceptedIds = (accepted ?? []).map(item => item.id);
  if (acceptedIds.length === 0) return reply({ configured: pushConfigured(), devices: 0, guests: 0 });
  const { data, error } = await supabase.from('push_subscriptions').select('id,rsvp_id').in('rsvp_id', acceptedIds);
  if (error) return reply({ error: 'Impossible de charger les abonnements.' }, 500);
  const subscriptions = data ?? [];
  return reply({
    configured: pushConfigured(),
    devices: subscriptions.length,
    guests: new Set(subscriptions.map(item => item.rsvp_id)).size,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await organizerPushClient(request);
  if (!supabase) return reply({ error: 'Accès réservé aux organisateurs.' }, 403);
  if (!pushConfigured()) return reply({ error: 'Les clés de notification ne sont pas configurées sur le serveur.' }, 503);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return reply({ error: 'Données invalides.' }, 400); }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (title.length < 2 || title.length > 60 || message.length < 2 || message.length > 240) {
    return reply({ error: 'Le titre doit contenir 2 à 60 caractères et le message 2 à 240 caractères.' }, 400);
  }

  const { data: accepted, error: guestsError } = await supabase
    .from('rsvp_responses').select('id').eq('attendance_status', 'accepted');
  if (guestsError) return reply({ error: 'Impossible de vérifier les invitations confirmées.' }, 500);
  const acceptedIds = (accepted ?? []).map(item => item.id);
  if (acceptedIds.length === 0) return reply({ sent: 0, failed: 0, removed: 0 });

  const { data: rows, error: subscriptionsError } = await supabase
    .from('push_subscriptions').select('id,endpoint,p256dh,auth,rsvp_id').in('rsvp_id', acceptedIds);
  if (subscriptionsError) return reply({ error: 'Impossible de charger les appareils inscrits.' }, 500);
  const subscriptions = rows ?? [];
  let sent = 0, failed = 0, removed = 0;
  const payload = JSON.stringify({ title, body: message, url: '/' });

  for (const row of subscriptions) {
    try {
      const statusCode = await sendWebPush({
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }, payload);
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
        removed += 1;
      } else if (statusCode < 200 || statusCode >= 300) {
        failed += 1;
      } else {
        sent += 1;
      }
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
        removed += 1;
      } else {
        failed += 1;
        console.error('Dot push delivery failed:', statusCode || 'unknown');
      }
    }
  }
  return reply({ sent, failed, removed, total: subscriptions.length });
}
