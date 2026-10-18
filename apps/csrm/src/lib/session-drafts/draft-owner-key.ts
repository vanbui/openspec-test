import 'server-only';

import { createHash } from 'node:crypto';

import type { Session } from '@/lib/auth/session-adapter';

/*
 * The owner part of a session-draft key (13-UI-SPEC §9.3, UI-D17, UI-D31; T-13-32): unsent text kept in the tab's
 * sessionStorage is keyed by the signed-in person and the request, so a second person signing in on a shared browser
 * never sees the first person's text. No personal value reaches the storage key in clear.
 *
 * An OIDC session already carries `identityKey`, an opaque SHA-256 of the subject that reaches the shell's client
 * props, so its first 32 hex characters are the key and nothing new is hashed. A development session has none, so its
 * email, fixture role or display name is hashed instead. The key protects text from the next person at the screen; it
 * is not authorisation, which Strapi decides.
 */

const OWNER_KEY_LENGTH = 32;

export function draftOwnerKey(session: Pick<Session, 'displayName' | 'identityKey' | 'email' | 'developmentRole'>): string {
  if (session.identityKey) return session.identityKey.slice(0, OWNER_KEY_LENGTH);
  const identity = session.email ?? session.developmentRole ?? session.displayName;
  return createHash('sha256').update(identity).digest('hex').slice(0, OWNER_KEY_LENGTH);
}
