import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Encrypts bank tokens at rest (AES-256-GCM) and signs short-lived link state (HMAC-SHA256). */
export class Sealer {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;

  constructor(keyBase64: string) {
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be base64 of exactly 32 bytes (openssl rand -base64 32)');
    }
    // Separate keys for the two jobs, both derived from the one secret.
    this.encKey = createHmac('sha256', key).update('finpal:encrypt').digest();
    this.macKey = createHmac('sha256', key).update('finpal:sign').digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
  }

  decrypt(sealed: string): string {
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised sealed value');
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  sign(payload: object, ttlMs: number, now = Date.now()): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs })).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  /** Returns the signed payload, or null if it was tampered with or has expired. */
  verify<T>(token: string, now = Date.now()): T | null {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    return payload.exp > now ? payload : null;
  }

  private mac(body: string): string {
    return createHmac('sha256', this.macKey).update(body).digest('base64url');
  }
}
