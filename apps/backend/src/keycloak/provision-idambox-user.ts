import type { Core } from "@strapi/strapi";

import {
  KeycloakAdminClient,
  type KeycloakUserPayload,
  type KeycloakUserUpdatePayload,
} from "./admin-client";
import { getKeycloakProvisioningConfig } from "./config";

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

export async function provisionIdamboxUserToKeycloak(
  strapi: Core.Strapi,
  user: IdamBoxUserDocument,
  password?: string | null,
) {
  const config = getKeycloakProvisioningConfig();

  if (!config.enabled) {
    return null;
  }

  const client = new KeycloakAdminClient(config);
  const passwordValue = getNonEmptyPassword(password);
  const existingUser = user.externalSubject
    ? await client.findUserById(user.externalSubject)
    : await client.findUserByEmail(user.email);
  const keycloakUser =
    existingUser ?? (await client.findUserByEmail(user.email));
  const payload = toKeycloakUserPayload(user);
  let keycloakUserId = keycloakUser?.id;

  if (keycloakUserId) {
    await client.updateUser(keycloakUserId, toKeycloakUserUpdatePayload(payload));
  } else {
    keycloakUserId = await client.createUser({
      ...payload,
      requiredActions: passwordValue
        ? undefined
        : [UPDATE_PASSWORD_REQUIRED_ACTION],
      credentials: passwordValue
        ? [
            {
              type: "password",
              value: passwordValue,
              temporary: false,
            },
          ]
        : undefined,
    });
  }

  if (keycloakUserId && passwordValue && keycloakUser) {
    await client.resetPassword(keycloakUserId, passwordValue);
  }

  await clearProvisioningSecrets(strapi, user.documentId, keycloakUserId);

  return keycloakUserId;
}

function toKeycloakUserUpdatePayload(
  payload: KeycloakUserPayload,
): KeycloakUserUpdatePayload {
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

function getNonEmptyPassword(password?: string | null) {
  if (typeof password !== "string" || password.trim().length === 0) {
    return null;
  }

  return password;
}

async function clearProvisioningSecrets(
  strapi: Core.Strapi,
  documentId: string,
  externalSubject: string,
) {
  await strapi.db.query(IDAMBOX_USER_UID).update({
    where: {
      documentId,
    },
    data: {
      externalSubject,
      password: null,
    },
  });
}
