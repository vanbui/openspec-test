import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import type { KeycloakTokenVerificationConfig } from "./token-verification-config";

/** Resolves the verified Keycloak subject, or rejects. The reason never leaves the server. */
export type AccessTokenVerifier = (token: string) => Promise<string>;

export class AccessTokenRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessTokenRejectedError";
  }
}

/*
 * Verifies a Keycloak access token issued to the CSRM client (docs/adr/0004):
 * RS256 signature against the realm JWKS, `iss`, `exp`/`nbf`, the CSRM client in
 * `aud` (the realm's audience mapper) and as `azp`, and Keycloak's own
 * `typ: "Bearer"`. The ID token carries the same `aud`, so `typ` is what keeps an
 * ID token from standing in for an access token. `sub` must be present, which
 * needs the realm's `basic` client scope.
 */
export function createAccessTokenVerifier(
  config: KeycloakTokenVerificationConfig,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`), {
    timeoutDuration: config.requestTimeoutMs,
  }),
): AccessTokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "sub"],
      clockTolerance: 5,
    });

    if (payload.typ !== "Bearer") throw new AccessTokenRejectedError("not an access token");
    if (payload.azp !== config.clientId) throw new AccessTokenRejectedError("unexpected authorized party");
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AccessTokenRejectedError("missing subject");
    }

    return payload.sub;
  };
}
