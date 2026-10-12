import formbody from '@fastify/formbody';
import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { Sealer } from './crypto';
import type { FinverseClient } from './finverse';
import type { Store } from './store';
import { syncUser } from './sync';

export interface BankDeps {
  finverse: FinverseClient;
  store: Store;
  sealer: Sealer;
  /** Allowed returnTo URLs; an entry ending in * is a prefix. */
  appRedirects: string[];
}

const LINK_STATE_TTL_MS = 15 * 60_000;

type LinkState = { userId: string; returnTo: string };

export function isAllowedRedirect(url: string, allowed: string[]): boolean {
  return allowed.some((entry) => (entry.endsWith('*') ? url.startsWith(entry.slice(0, -1)) : url === entry));
}

function withStatus(returnTo: string, status: 'ok' | 'error'): string {
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}status=${status}`;
}

const linkTokenBody = z.object({ returnTo: z.string().min(1) });
const callbackParams = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function bankRoutes(app: FastifyInstance, deps: BankDeps, auth: preHandlerHookHandler) {
  const { finverse, store, sealer, appRedirects } = deps;
  await app.register(formbody);

  app.post('/link/token', { preHandler: auth }, async (request, reply) => {
    const body = linkTokenBody.safeParse(request.body);
    if (!body.success || !isAllowedRedirect(body.data.returnTo, appRedirects)) {
      return reply.code(400).send({ error: 'returnTo is missing or not allowed' });
    }
    const state = sealer.sign({ userId: request.userId, returnTo: body.data.returnTo }, LINK_STATE_TTL_MS);
    const linkUrl = await finverse.createLinkUrl({ userId: request.userId, state });
    return { linkUrl };
  });

  // Finverse Link sends the user back here; form_post makes it a POST, GET covers query mode.
  const callback = async (params: unknown, reply: FastifyReply) => {
    const parsed = callbackParams.safeParse(params);
    const state = parsed.success && parsed.data.state ? sealer.verify<LinkState>(parsed.data.state) : null;
    if (!parsed.success || !state) {
      return reply.code(400).type('text/plain').send('This link has expired. Go back to finpal and try again.');
    }
    const { code, error } = parsed.data;
    if (error || !code) {
      app.log.warn({ error, description: parsed.data.error_description }, 'Finverse Link returned an error');
      return reply.redirect(withStatus(state.returnTo, 'error'), 303);
    }
    try {
      const tokens = await finverse.exchangeCode(code);
      await store.saveConnection(state.userId, tokens);
    } catch (err) {
      app.log.error(err, 'Finverse code exchange failed');
      return reply.redirect(withStatus(state.returnTo, 'error'), 303);
    }
    return reply.redirect(withStatus(state.returnTo, 'ok'), 303);
  };
  app.post('/link/callback', (request, reply) => callback(request.body, reply));
  app.get('/link/callback', (request, reply) => callback(request.query, reply));

  app.post('/sync', { preHandler: auth }, async (request) => syncUser(request.userId, finverse, store));

  app.get('/accounts', { preHandler: auth }, async (request) => ({
    accounts: await store.listAccounts(request.userId),
  }));

  app.get('/transactions', { preHandler: auth }, async (request, reply) => {
    const page = pageQuery.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: 'invalid paging' });
    return { transactions: await store.listTransactions(request.userId, page.data) };
  });
}

/** Stand-in routes when Finverse isn't configured, so the app gets a clear answer. */
export async function bankNotConfigured(app: FastifyInstance) {
  const reply503 = async (_: unknown, reply: FastifyReply) =>
    reply.code(503).send({ error: 'Bank linking is not configured on the server yet' });
  for (const [method, url] of [
    ['POST', '/link/token'],
    ['POST', '/link/callback'],
    ['GET', '/link/callback'],
    ['POST', '/sync'],
    ['GET', '/accounts'],
    ['GET', '/transactions'],
  ] as const) {
    app.route({ method, url, handler: reply503 });
  }
}
