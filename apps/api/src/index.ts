import { supabaseVerifier } from './auth';
import type { BankDeps } from './bank';
import { Sealer } from './crypto';
import { bankEnv, loadEnv } from './env';
import { createFinverseClient } from './finverse';
import { buildServer } from './server';
import { createSupabaseStore } from './store';

const env = loadEnv();
const bank = bankEnv(env);

let deps: BankDeps | null = null;
if (bank) {
  const sealer = new Sealer(bank.tokenEncryptionKey);
  deps = {
    sealer,
    finverse: createFinverseClient(bank),
    store: createSupabaseStore(env.SUPABASE_URL, bank.supabaseServiceRoleKey, sealer),
    appRedirects: env.APP_REDIRECT_URLS.split(',').map((u) => u.trim()),
  };
}

const app = await buildServer(env, supabaseVerifier(env), deps);
if (!deps) app.log.warn('Finverse settings are incomplete; bank linking routes will answer 503');
await app.listen({ port: env.PORT, host: env.HOST });
