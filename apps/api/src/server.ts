import cors from '@fastify/cors';
import Fastify from 'fastify';

import { requireUser, type VerifyToken } from './auth';
import type { Env } from './env';

export async function buildServer(env: Env, verify: VerifyToken) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()) });

  app.get('/health', async () => ({ ok: true }));

  app.get('/me', { preHandler: requireUser(verify) }, async (request) => ({ userId: request.userId }));

  return app;
}
