import { z } from 'zod';

// An empty value in .env means "not set".
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), type.optional());

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Comma-separated origins allowed to call the API from a browser. */
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Bank linking. All of these must be set for the /link and /sync routes to work.
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  FINVERSE_BASE_URL: optional(z.url()),
  FINVERSE_CLIENT_ID: optional(z.string().min(1)),
  FINVERSE_CLIENT_SECRET: optional(z.string().min(1)),
  /** Public URL of this server's POST /link/callback, registered with Finverse. */
  FINVERSE_REDIRECT_URI: optional(z.url()),
  /** Base64 of 32 random bytes; encrypts bank tokens at rest and signs link state. */
  TOKEN_ENCRYPTION_KEY: optional(z.string().min(1)),
  /**
   * Comma-separated places the app may ask to be sent back to after linking.
   * An entry ending in * matches any URL starting with the rest of it.
   */
  APP_REDIRECT_URLS: z.string().default('http://localhost:8081/linked,finpal://linked,exp://*'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export interface BankEnv {
  supabaseServiceRoleKey: string;
  finverseBaseUrl: string;
  finverseClientId: string;
  finverseClientSecret: string;
  finverseRedirectUri: string;
  tokenEncryptionKey: string;
}

/** Returns the bank-linking settings, or null when any of them is missing. */
export function bankEnv(env: Env): BankEnv | null {
  const {
    SUPABASE_SERVICE_ROLE_KEY,
    FINVERSE_BASE_URL,
    FINVERSE_CLIENT_ID,
    FINVERSE_CLIENT_SECRET,
    FINVERSE_REDIRECT_URI,
    TOKEN_ENCRYPTION_KEY,
  } = env;
  if (
    !SUPABASE_SERVICE_ROLE_KEY ||
    !FINVERSE_BASE_URL ||
    !FINVERSE_CLIENT_ID ||
    !FINVERSE_CLIENT_SECRET ||
    !FINVERSE_REDIRECT_URI ||
    !TOKEN_ENCRYPTION_KEY
  ) {
    return null;
  }
  return {
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    finverseBaseUrl: FINVERSE_BASE_URL,
    finverseClientId: FINVERSE_CLIENT_ID,
    finverseClientSecret: FINVERSE_CLIENT_SECRET,
    finverseRedirectUri: FINVERSE_REDIRECT_URI,
    tokenEncryptionKey: TOKEN_ENCRYPTION_KEY,
  };
}
