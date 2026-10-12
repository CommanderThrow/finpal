import { supabaseVerifier } from './auth';
import { loadEnv } from './env';
import { buildServer } from './server';

const env = loadEnv();
const app = await buildServer(env, supabaseVerifier(env));
await app.listen({ port: env.PORT, host: env.HOST });
