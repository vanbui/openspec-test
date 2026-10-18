import type { KeycloakProvisioningConfig } from "./config";

export type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
};

export type KeycloakUserPayload = {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
  requiredActions?: string[];
  credentials?: Array<{
    type: "password";
    value: string;
    temporary: boolean;
  }>;
};

// Keycloak usernames are immutable by default, so updates never send one.
export type KeycloakUserUpdatePayload = Omit<KeycloakUserPayload, "username">;

/*
 * Every failure is reported as this error. The message carries the operation,
 * the HTTP status and at most Keycloak's short error code; never a request or
 * response body, a token or the client secret.
 */
export class KeycloakProvisioningError extends Error {
  constructor(message: string, readonly status?: number, readonly cause?: unknown) {
    super(message);
    this.name = "KeycloakProvisioningError";
  }
}

// Refresh a cached token this long before Keycloak says it expires.
const TOKEN_EXPIRY_SKEW_MS = 30_000;

type CachedToken = { value: string; expiresAt: number };
type RequestOptions = { method?: string; body?: unknown; allowNotFound?: boolean };

export type RevocationOptions = { deadline?: number; signal?: AbortSignal };
export type KeycloakSyncErrorCode = "KEYCLOAK_TIMEOUT" | "KEYCLOAK_UNAVAILABLE" | "KEYCLOAK_AUTH" | "KEYCLOAK_CONFLICT" | "KEYCLOAK_CONFIG";
export class KeycloakRevocationError extends Error {
  constructor(readonly code: KeycloakSyncErrorCode) { super(code); this.name = "KeycloakRevocationError"; }
}

/** Bound waiting even when another caller owns the shared token request. */
async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void work.catch(() => undefined);
    throw new KeycloakRevocationError("KEYCLOAK_TIMEOUT");
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new KeycloakRevocationError("KEYCLOAK_TIMEOUT"));
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export class KeycloakAdminClient {
  private cachedToken?: CachedToken;
  private pendingToken?: Promise<string>;

  constructor(
    private readonly config: KeycloakProvisioningConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async findUserById(id: string): Promise<KeycloakUser | null> {
    const response = await this.adminRequest("look up user", `/users/${encodeURIComponent(id)}`, { allowNotFound: true });
    return response.status === 404 ? null : ((await response.json()) as KeycloakUser);
  }

  async findUserByEmail(email: string): Promise<KeycloakUser | null> {
    const response = await this.adminRequest("search users", `/users?exact=true&email=${encodeURIComponent(email)}`);
    const users = (await response.json()) as KeycloakUser[];
    // Keycloak stores emails lower-cased; Strapi keeps the case it was given.
    const wanted = email.toLowerCase();
    return users.find((user) => user.email?.toLowerCase() === wanted) ?? null;
  }

  /** Throws a KeycloakProvisioningError with status 409 when the username or email is taken. */
  async createUser(payload: KeycloakUserPayload): Promise<string> {
    const response = await this.adminRequest("create user", "/users", { method: "POST", body: payload });
    const id = response.headers.get("location")?.split("/").pop();
    if (id) return decodeURIComponent(id);

    const created = await this.findUserByEmail(payload.email);
    if (created) return created.id;
    throw new KeycloakProvisioningError("Keycloak created the user but returned no user id.");
  }

  async updateUser(id: string, payload: KeycloakUserUpdatePayload): Promise<void> {
    await this.adminRequest("update user", `/users/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.adminRequest("set password", `/users/${encodeURIComponent(id)}/reset-password`, {
      method: "PUT",
      body: { type: "password", value: password, temporary: false },
    });
  }

  /** One action-email attempt; acceptance is not proof of mailbox delivery. */
  async executeActionsEmail(subject: string, actions: readonly ["UPDATE_PASSWORD"], parentSignal: AbortSignal): Promise<void> {
    if (actions.length !== 1 || actions[0] !== "UPDATE_PASSWORD") throw new KeycloakRevocationError("KEYCLOAK_CONFIG");
    if (parentSignal.aborted) throw new KeycloakRevocationError("KEYCLOAK_TIMEOUT");
    const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(Math.min(5000, this.config.requestTimeoutMs))]);
    try {
      const token = await abortable(this.getAccessToken(signal), signal);
      const response = await abortable(fetch(`${this.config.baseUrl}/admin/realms/${encodeURIComponent(this.config.realm)}/users/${encodeURIComponent(subject)}/execute-actions-email`, {
        method: "PUT", redirect: "error", signal,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(actions),
      }), signal);
      await abortable(discardBody(response), signal);
      if (!response.ok) throw new KeycloakRevocationError(response.status === 401 || response.status === 403 ? "KEYCLOAK_AUTH" : "KEYCLOAK_UNAVAILABLE");
    } catch (error) {
      if (error instanceof KeycloakRevocationError) throw error;
      throw new KeycloakRevocationError(signal.aborted ? "KEYCLOAK_TIMEOUT" : "KEYCLOAK_UNAVAILABLE");
    }
  }

  async disableUser(subject: string | null | undefined, options: RevocationOptions = {}): Promise<void> {
    if (!subject) return;
    await this.revoke(subject, false, options);
  }

  async endUserSessions(subject: string | null | undefined, options: RevocationOptions = {}): Promise<void> {
    if (!subject) return;
    await this.revoke(subject, true, options);
  }

  private async revoke(subject: string, logout: boolean, options: RevocationOptions): Promise<void> {
    const remaining = (options.deadline ?? Date.now() + 30_000) - Date.now();
    if (remaining <= 0 || options.signal?.aborted) throw new KeycloakRevocationError("KEYCLOAK_TIMEOUT");
    const signal = AbortSignal.any([AbortSignal.timeout(Math.min(5000, this.config.requestTimeoutMs, remaining)),
      ...(options.signal ? [options.signal] : [])]);
    const url = `${this.config.baseUrl}/admin/realms/${encodeURIComponent(this.config.realm)}/users/${encodeURIComponent(subject)}${logout ? "/logout" : ""}`;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = await abortable(this.getAccessToken(signal), signal);
        const response = await abortable(fetch(url, { method: logout ? "POST" : "PUT", redirect: "error", signal,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          ...(logout ? {} : { body: JSON.stringify({ enabled: false }) }) }), signal);
        // Never read remote error text. Body cleanup remains inside the call budget.
        await abortable(discardBody(response), signal);
        if (response.status === 401 && attempt === 0) { this.cachedToken = undefined; continue; }
        if (response.ok || response.status === 404) return;
        throw new KeycloakRevocationError(response.status === 401 || response.status === 403 ? "KEYCLOAK_AUTH"
          : response.status === 409 ? "KEYCLOAK_CONFLICT" : "KEYCLOAK_UNAVAILABLE");
      }
    } catch (error) {
      if (error instanceof KeycloakRevocationError) throw error;
      if (signal.aborted || (error instanceof Error && /TimeoutError|AbortError/.test(error.name))) {
        throw new KeycloakRevocationError("KEYCLOAK_TIMEOUT");
      }
      throw new KeycloakRevocationError(error instanceof KeycloakProvisioningError && (error.status === 401 || error.status === 403)
        ? "KEYCLOAK_AUTH" : "KEYCLOAK_UNAVAILABLE");
    }
  }

  private async adminRequest(operation: string, path: string, options: RequestOptions = {}): Promise<Response> {
    const url = `${this.config.baseUrl}/admin/realms/${encodeURIComponent(this.config.realm)}${path}`;
    let response = await this.send(operation, url, options, await this.getAccessToken());

    // A token revoked or expired early (clock skew, realm key rotation) is retried once with a fresh one.
    if (response.status === 401) {
      await discardBody(response);
      this.cachedToken = undefined;
      response = await this.send(operation, url, options, await this.getAccessToken());
    }

    if (options.allowNotFound && response.status === 404) {
      await discardBody(response);
      return response;
    }
    if (!response.ok) {
      throw new KeycloakProvisioningError(
        `Keycloak ${operation} failed with HTTP ${response.status}${await describeKeycloakError(response)}.`,
        response.status,
      );
    }
    return response;
  }

  private async send(operation: string, url: string, options: RequestOptions, token: string): Promise<Response> {
    return this.fetchWithTimeout(operation, url, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  private getAccessToken(signal?: AbortSignal): Promise<string> {
    if (this.cachedToken && this.now() < this.cachedToken.expiresAt) {
      return Promise.resolve(this.cachedToken.value);
    }
    // Concurrent writes share one token request.
    this.pendingToken ??= this.requestAccessToken(signal).finally(() => {
      this.pendingToken = undefined;
    });
    return this.pendingToken;
  }

  private async requestAccessToken(signal?: AbortSignal): Promise<string> {
    const tokenUrl = `${this.config.baseUrl}/realms/${encodeURIComponent(this.config.realm)}/protocol/openid-connect/token`;
    const response = await this.fetchWithTimeout("token request", tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.adminClientId,
        client_secret: this.config.adminClientSecret,
      }),
    }, signal);

    if (!response.ok) {
      throw new KeycloakProvisioningError(
        `Keycloak token request failed with HTTP ${response.status}${await describeKeycloakError(response)}.`,
        response.status,
      );
    }

    const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
      throw new KeycloakProvisioningError("Keycloak token response did not include an access token.");
    }

    const lifetimeMs = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in * 1000 : 0;
    // A lifetime shorter than the skew is used once and not cached.
    this.cachedToken = { value: payload.access_token, expiresAt: this.now() + lifetimeMs - TOKEN_EXPIRY_SKEW_MS };
    return payload.access_token;
  }

  private async fetchWithTimeout(operation: string, url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(url, { ...init, redirect: "error", signal: AbortSignal.any([
        AbortSignal.timeout(this.config.requestTimeoutMs), ...(signal ? [signal] : []),
      ]) });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new KeycloakProvisioningError(
        timedOut
          ? `Keycloak ${operation} timed out after ${this.config.requestTimeoutMs} ms.`
          : `Keycloak ${operation} could not reach Keycloak.`,
        undefined,
        error,
      );
    }
  }
}

async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/*
 * Keycloak error bodies are JSON with a short machine-readable code. Only that
 * code is kept, capped in length; HTML error pages and anything else are dropped.
 */
async function describeKeycloakError(response: Response): Promise<string> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return "";
  }
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const code = [body.errorMessage, body.error].find((value): value is string => typeof value === "string");
    return code ? ` (${code.slice(0, 120)})` : "";
  } catch {
    return "";
  }
}
