import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeRateLimit } from './rsvp-server';

function client(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

describe('consumeRateLimit', () => {
  it('returns false when the attempt is allowed', async () => {
    const { supabase, rpc } = client({ data: false, error: null });

    await expect(consumeRateLimit(supabase, {
      ipHash: 'a'.repeat(64),
      windowMinutes: 60,
      limit: 10,
    })).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledWith('consume_rsvp_rate_limit', {
      p_ip_hash: 'a'.repeat(64),
      p_window_minutes: 60,
      p_limit: 10,
    });
  });

  it('returns true when the attempt exceeds the limit', async () => {
    const { supabase } = client({ data: true, error: null });

    await expect(consumeRateLimit(supabase, {
      ipHash: 'b'.repeat(64),
      windowMinutes: 60,
      limit: 10,
    })).resolves.toBe(true);
  });

  it('fails closed when the database rate-limit function is unavailable', async () => {
    const { supabase } = client({ data: null, error: { message: 'function unavailable' } });

    await expect(consumeRateLimit(supabase, {
      ipHash: 'c'.repeat(64),
      windowMinutes: 60,
      limit: 10,
    })).rejects.toThrow('RSVP_RATE_LIMIT_UNAVAILABLE');
  });
});
