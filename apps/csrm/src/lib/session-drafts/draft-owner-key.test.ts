import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { draftOwnerKey } from './draft-owner-key';

describe('draftOwnerKey (UI-D17, T-13-32)', () => {
  it('reuses the OIDC session’s opaque identity key, shortened, with no new hash', () => {
    const identityKey = 'a'.repeat(32) + 'b'.repeat(32);
    expect(draftOwnerKey({ displayName: 'Bob Doe', email: 'bob@example.test', identityKey })).toBe('a'.repeat(32));
  });

  it('hashes the development identity to 32 hex characters, the same for the same session', () => {
    const key = draftOwnerKey({ displayName: 'Bob Doe', developmentRole: 'Security Analyst' });
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(draftOwnerKey({ displayName: 'Bob Doe', developmentRole: 'Security Analyst' })).toBe(key);
  });

  it('keeps two development roles apart', () => {
    expect(draftOwnerKey({ displayName: 'Bob Doe', developmentRole: 'Security Analyst' }))
      .not.toBe(draftOwnerKey({ displayName: 'Second Analyst', developmentRole: 'Second Security Analyst' }));
    expect(draftOwnerKey({ displayName: 'Same', developmentRole: 'Requestor' }))
      .not.toBe(draftOwnerKey({ displayName: 'Same', developmentRole: 'Secondary Requestor' }));
  });

  /*
   * IN-502: a hex key can never hold "bob" or "Bob", so the old substring checks could not fail. The key is instead the
   * first 32 characters of the identity's SHA-256, never a reversible encoding of it such as its hex.
   */
  it('never carries the email or the display name in clear: the key is the identity’s SHA-256, not an encoding of it', () => {
    const sha = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);
    const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex').slice(0, 32);
    for (const [session, identity] of [
      [{ displayName: 'Bob Doe', email: 'bob@example.test' }, 'bob@example.test'],
      [{ displayName: 'Bob Doe' }, 'Bob Doe'],
      [{ displayName: 'Bob Doe', developmentRole: 'Security Analyst' as const }, 'Security Analyst'],
    ] as const) {
      const key = draftOwnerKey(session);
      expect(key).toBe(sha(identity));
      expect(key).not.toBe(hex(identity));
    }
  });

  it('hashes the email ahead of the development role when a session carries both (IN-502)', () => {
    const sha = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);
    expect(draftOwnerKey({ displayName: 'Bob Doe', email: 'bob@example.test', developmentRole: 'Security Analyst' })).toBe(sha('bob@example.test'));
  });

  it('runs on the server only', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/session-drafts/draft-owner-key.ts'), 'utf8');
    expect(source.startsWith("import 'server-only';")).toBe(true);
  });
});
