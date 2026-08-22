import { createHash, timingSafeEqual } from "node:crypto";

import type { Core } from "@strapi/strapi";

const ACTOR_EMAIL_HEADER = "x-idambox-csrm-actor-email";
const ANALYST_FUNCTION_MENU_PATH = "Risk Assessment Requests:Requests";

export type CsrmActor = {
  documentId: string;
  email: string;
  isAnalyst: boolean;
};

type PolicyContext = {
  forbidden?: (message: string) => unknown;
  request: { headers: Record<string, string | string[] | undefined> };
  state: Record<string, unknown>;
};

function headerValue(
  headers: PolicyContext["request"]["headers"],
  name: string,
): string | undefined {
  const value = headers[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function hasValidToken(received: string | undefined): boolean {
  const configured = process.env.IDAMBOX_CSRM_INTERNAL_TOKEN;
  if (!configured || Buffer.byteLength(configured, "utf8") < 32 || !received) {
    return false;
  }

  const supplied = received.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supplied) return false;

  return timingSafeEqual(tokenDigest(configured), tokenDigest(supplied));
}

function hasAnalystCapability(user: Record<string, unknown>): boolean {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some((role) => {
    const functions =
      role && typeof role === "object" && Array.isArray((role as { functions?: unknown }).functions)
        ? (role as { functions: unknown[] }).functions
        : [];
    return functions.some(
      (platformFunction) =>
        platformFunction &&
        typeof platformFunction === "object" &&
        (platformFunction as { menuPath?: unknown }).menuPath === ANALYST_FUNCTION_MENU_PATH,
    );
  });
}

export default async (
  policyContext: PolicyContext,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const authorization = headerValue(policyContext.request.headers, "authorization");
  const actorEmail = headerValue(policyContext.request.headers, ACTOR_EMAIL_HEADER)?.toLowerCase();

  if (!hasValidToken(authorization) || !actorEmail) {
    return policyContext.forbidden?.("CSRM internal caller authentication failed.") ?? false;
  }

  const users = (await strapi.documents("api::idambox-user.idambox-user").findMany({
    filters: {
      $and: [
        { email: { $eq: actorEmail } },
        { accountStatus: { $eq: "active" } },
      ],
    },
    populate: { roles: { populate: { functions: true } } },
    limit: 2,
  })) as Array<Record<string, unknown>>;

  if (users.length !== 1 || typeof users[0].documentId !== "string") {
    return policyContext.forbidden?.("CSRM internal caller authentication failed.") ?? false;
  }

  policyContext.state.csrmActor = {
    documentId: users[0].documentId,
    email: actorEmail,
    isAnalyst: hasAnalystCapability(users[0]),
  } satisfies CsrmActor;
  return true;
};
