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

export async function DELETE(request: NextRequest) {
  const supabase = await organizerClient(request);
  if (!supabase) return reply({ error: 'Accès réservé aux organisateurs.' }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return reply({ error: 'Données invalides.' }, 400); }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: 'Inscription invalide.' }, 400);

  const { data, error } = await supabase
    .from('rsvp_responses')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Dot RSVP deletion failed:', error.message);
    return reply({ error: 'Suppression impossible. Vérifiez que les données liées à cette inscription peuvent être supprimées.' }, 409);
  }
  if (!data) return reply({ error: 'Cette inscription n’existe plus. Actualisez la liste.' }, 404);
  return reply({ ok: true });
}
