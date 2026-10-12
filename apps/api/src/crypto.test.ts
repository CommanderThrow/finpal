import { describe, expect, it } from 'vitest';

import { Sealer } from './crypto';
import { TEST_KEY } from './testing/fakes';

const sealer = new Sealer(TEST_KEY);

describe('Sealer', () => {
  it('rejects keys that are not 32 bytes', () => {
    expect(() => new Sealer(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('round-trips encrypted values with a fresh IV each time', () => {
    const a = sealer.encrypt('secret-token');
    const b = sealer.encrypt('secret-token');
    expect(a).not.toBe(b);
    expect(a).not.toContain('secret-token');
    expect(sealer.decrypt(a)).toBe('secret-token');
  });

  it('refuses tampered ciphertext', () => {
    const sealed = sealer.encrypt('secret-token');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => sealer.decrypt(parts.join('.'))).toThrow();
  });

  it('verifies signed state until it expires', () => {
    const token = sealer.sign({ userId: 'u1' }, 1000, 0);
    expect(sealer.verify<{ userId: string }>(token, 500)?.userId).toBe('u1');
    expect(sealer.verify(token, 1500)).toBeNull();
  });

  it('refuses state signed with another key or edited', () => {
    const other = new Sealer(Buffer.alloc(32, 9).toString('base64'));
    expect(sealer.verify(other.sign({ userId: 'u1' }, 1000))).toBeNull();
    const [, mac] = sealer.sign({ userId: 'u1' }, 1000).split('.');
    const forged = Buffer.from(JSON.stringify({ userId: 'u2', exp: Date.now() + 1000 })).toString('base64url');
    expect(sealer.verify(`${forged}.${mac}`)).toBeNull();
  });
});
