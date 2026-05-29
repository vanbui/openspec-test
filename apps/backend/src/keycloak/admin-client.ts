import type { KeycloakProvisioningConfig } from './config';

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
    type: 'password';
    value: string;
    temporary: boolean;
  }>;
};

export type KeycloakUserUpdatePayload = Omit<KeycloakUserPayload, 'username'>;

export class KeycloakAdminClient {
  private accessToken?: string;

  constructor(private readonly config: KeycloakProvisioningConfig) {}

  async findUserById(id: string) {
    return this.request<KeycloakUser | null>(`/admin/realms/${this.config.realm}/users/${id}`, {
      allowNotFound: true,
    });
  }

  async findUserByEmail(email: string) {
    const users = await this.request<KeycloakUser[]>(
      `/admin/realms/${this.config.realm}/users?exact=true&email=${encodeURIComponent(email)}`,
    );

    return users.find((user) => user.email === email) ?? null;
  }

  async createUser(payload: KeycloakUserPayload) {
    const response = await this.requestResponse(`/admin/realms/${this.config.realm}/users`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const location = response.headers.get('location');
    const id = location?.split('/').pop();

    if (!id) {
      const createdUser = await this.findUserByEmail(payload.email);

      if (createdUser) {
        return createdUser.id;
      }

      throw new Error('Keycloak user was created but no user id was returned.');
    }

    return id;
  }

  async updateUser(id: string, payload: KeycloakUserUpdatePayload) {
    await this.requestResponse(`/admin/realms/${this.config.realm}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async resetPassword(id: string, password: string) {
    await this.requestResponse(`/admin/realms/${this.config.realm}/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'password',
        value: password,
        temporary: false,
      }),
    });
  }

  private async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.adminClientId,
      client_secret: this.config.adminClientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Keycloak token request failed with ${response.status} ${response.statusText}.`);
    }

    const payload = (await response.json()) as { access_token?: string };

    if (!payload.access_token) {
      throw new Error('Keycloak token response did not include an access token.');
    }

    this.accessToken = payload.access_token;
    return payload.access_token;
  }

  private async request<T>(path: string, options: RequestInit & { allowNotFound?: boolean } = {}) {
    const response = await this.requestResponse(path, options);

    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  }

  private async requestResponse(path: string, options: RequestInit & { allowNotFound?: boolean } = {}) {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...options.headers,
      },
    });

    if (options.allowNotFound && response.status === 404) {
      return response;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Keycloak Admin API request failed with ${response.status} ${response.statusText}: ${body}`);
    }

    return response;
  }
}
