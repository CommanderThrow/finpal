import cors from '@fastify/cors';
import Fastify from 'fastify';

import { requireUser, type VerifyToken } from './auth';
import { bankNotConfigured, bankRoutes, type BankDeps } from './bank';
import type { Env } from './env';

export async function buildServer(env: Env, verify: VerifyToken, bank: BankDeps | null = null) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const auth = requireUser(verify);

  await app.register(cors, { origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()) });

  app.get('/health', async () => ({ ok: true, bankLinking: bank !== null }));

  app.get('/me', { preHandler: auth }, async (request) => ({ userId: request.userId }));

  if (bank) await bankRoutes(app, bank, auth);
  else await bankNotConfigured(app);

  return app;
}
