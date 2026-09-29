import {
  type KeycloakAdminClient,
  KeycloakProvisioningError,
  type KeycloakUserPayload,
  type KeycloakUserUpdatePayload,
} from "./admin-client";

export const IDAMBOX_USER_UID = "api::idambox-user.idambox-user";
export const UPDATE_PASSWORD_REQUIRED_ACTION = "UPDATE_PASSWORD";

export type IdamBoxUserDocument = {
  documentId: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  accountStatus?: "active" | "inactive" | null;
  externalSubject?: string | null;
};

/*
 * Creates or updates the Keycloak account for one IdamBox User and returns its
 * Keycloak user id. Idempotent: the account is found by externalSubject, then
 * by email (D-13/D-14), and a create that races another writer (409) falls back
 * to updating the account that won. `password` is the plaintext from the
 * Strapi write; it is set in Keycloak only when non-empty (D-15/D-17).
 */
export async function provisionIdamboxUser(
  client: KeycloakAdminClient,
  user: IdamBoxUserDocument,
  password: string | null,
): Promise<string> {
  const existing =
    (user.externalSubject ? await client.findUserById(user.externalSubject) : null) ??
    (await client.findUserByEmail(user.email));

  if (existing) {
    return updateExisting(client, existing.id, user, password);
  }

  try {
    return await client.createUser({
      ...toKeycloakUserPayload(user),
      requiredActions: password ? undefined : [UPDATE_PASSWORD_REQUIRED_ACTION],
      credentials: password ? [{ type: "password", value: password, temporary: false }] : undefined,
    });
  } catch (error) {
    if (!(error instanceof KeycloakProvisioningError) || error.status !== 409) throw error;
    // Created concurrently by email: adopt it. A username taken by another email stays a conflict.
    const winner = await client.findUserByEmail(user.email);
    if (!winner) throw error;
    return updateExisting(client, winner.id, user, password);
  }
}

async function updateExisting(
  client: KeycloakAdminClient,
  id: string,
  user: IdamBoxUserDocument,
  password: string | null,
): Promise<string> {
  await client.updateUser(id, toKeycloakUserUpdatePayload(toKeycloakUserPayload(user)));
  if (password) {
    await client.resetPassword(id, password);
  }
  return id;
}

function toKeycloakUserUpdatePayload(payload: KeycloakUserPayload): KeycloakUserUpdatePayload {
  const { username: _username, ...updatePayload } = payload;

  return updatePayload;
}

function toKeycloakUserPayload(user: IdamBoxUserDocument): KeycloakUserPayload {
  return {
    username: user.username,
    email: user.email,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    enabled: user.accountStatus !== "inactive",
    emailVerified: true,
    attributes: {
      displayName: [user.displayName],
    },
  };
}
