import type { Core } from "@strapi/strapi";

import {
  IDAMBOX_USER_UID,
  type IdamBoxUserDocument,
  provisionIdamboxUserToKeycloak,
} from "./provision-idambox-user";

const cleanupUpdates = new Set<string>();

type IdamBoxUserDocumentMiddlewareContext = {
  uid: string;
  action: string;
  params?: {
    data?: {
      password?: string | null;
    };
  };
};

export function registerIdamboxUserProvisioning(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    if (!isIdamboxUserWrite(context)) {
      return next();
    }

    const result = await next();
    const user = result as unknown as IdamBoxUserDocument | undefined;

    if (!user?.documentId || cleanupUpdates.has(user.documentId)) {
      return result;
    }

    const password =
      (context as IdamBoxUserDocumentMiddlewareContext).params?.data
        ?.password ?? null;

    try {
      cleanupUpdates.add(user.documentId);
      await provisionIdamboxUserToKeycloak(strapi, user, password);
    } finally {
      cleanupUpdates.delete(user.documentId);
    }

    return result;
  });
}

function isIdamboxUserWrite(context: { uid: string; action: string }) {
  return (
    context.uid === "api::idambox-user.idambox-user" &&
    context.uid === IDAMBOX_USER_UID &&
    (context.action === "create" || context.action === "update")
  );
}
