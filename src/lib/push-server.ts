import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createCipheriv, createECDH, createHmac, createPrivateKey, sign, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/rsvp-server';

export const PUSH_NO_STORE = { 'Cache-Control': 'no-store' };

export function pushOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === request.nextUrl.origin; }
  catch { return false; }
}

export async function organizerPushClient(request: NextRequest): Promise<SupabaseClient | null> {
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

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      host === 'fcm.googleapis.com' ||
      host === 'updates.push.services.mozilla.com' ||
      host === 'push.services.mozilla.com' ||
      host === 'web.push.apple.com' ||
      host.endsWith('.notify.windows.com')
    );
  } catch { return false; }
}

export function pushConfigured(): boolean {
  return Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY);
}

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function hmac(key: Buffer, value: Buffer): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  let output: Buffer = Buffer.alloc(0);
  let previous: Buffer = Buffer.alloc(0);
  let counter = 1;
  while (output.length < length) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    output = Buffer.concat([output, previous]);
    counter += 1;
  }
  return output.subarray(0, length);
}

function vapidAuthorization(endpoint: string): string {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY!;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY!;
  const publicBytes = Buffer.from(publicKey, 'base64url');
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error('Invalid VAPID public key');
  const key = createPrivateKey({
    key: {
      kty: 'EC', crv: 'P-256', d: privateKey,
      x: b64url(publicBytes.subarray(1, 33)),
      y: b64url(publicBytes.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: 'mailto:refontiq@gmail.com' }));
  const unsigned = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64url(signature)}, k=${publicKey}`;
}

/** Chiffrement Web Push standard aes128gcm (RFC 8291), sans service tiers. */
export function encryptPushPayload(subscription: { p256dh: string; auth: string }, message: string): Buffer {
  const userPublicKey = Buffer.from(subscription.p256dh, 'base64url');
  const authSecret = Buffer.from(subscription.auth, 'base64url');
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4 || authSecret.length !== 16) {
    throw new Error('Invalid push subscription keys');
  }

  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(userPublicKey);
  const authPrk = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), userPublicKey, serverPublicKey]);
  const inputKeyMaterial = hkdfExpand(authPrk, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = hmac(salt, inputKeyMaterial);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const plaintext = Buffer.concat([Buffer.from(message, 'utf8'), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublicKey.length]), serverPublicKey, ciphertext]);
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  message: string,
): Promise<number> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) throw new Error('Unsupported push service endpoint');
  const body = encryptPushPayload(subscription, message);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint),
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(60 * 60 * 24),
      Urgency: 'normal',
    },
    body,
    cache: 'no-store',
    redirect: 'error',
  });
  return response.status;
}
