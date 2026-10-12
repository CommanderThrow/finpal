import { createClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Env } from './env';

export type VerifyToken = (token: string) => Promise<{ userId: string } | null>;

/** Checks a Supabase access token by asking Supabase Auth who it belongs to. */
export function supabaseVerifier(env: Env): VerifyToken {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id };
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function requireUser(verify: VerifyToken) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const user = token ? await verify(token) : null;
    if (!user) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    request.userId = user.userId;
  };
}
