import type { Core } from "@strapi/strapi";

import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

export const DEVELOPMENT_API_TOKEN_NAME = "CSRM isolated development test token";

type ApiTokenRecord = { id: number };
type ApiTokenStore = {
  findOne: (input: { where: { name: string } }) => Promise<ApiTokenRecord | null>;
  create: (input: { data: Record<string, unknown> }) => Promise<unknown>;
  update: (input: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>;
};
type ApiTokenService = { hash: (accessKey: string) => string };

export async function seedDevelopmentApiToken(strapi: Core.Strapi): Promise<void> {
  const accessKey = process.env.CSRM_DEV_API_TOKEN;
  if (!developmentIdentityEnabled() || !accessKey) return;

  const apiTokenService = strapi.service("admin::api-token-content-api") as unknown as ApiTokenService;
  const apiTokenStore = strapi.db.query("admin::api-token") as unknown as ApiTokenStore;
  const existing = await apiTokenStore.findOne({ where: { name: DEVELOPMENT_API_TOKEN_NAME } });
  const data = {
    name: DEVELOPMENT_API_TOKEN_NAME,
    description: "Managed credential for isolated development test infrastructure",
    kind: "content-api",
    type: "full-access",
    accessKey: apiTokenService.hash(accessKey),
    encryptedKey: null,
    lifespan: null,
    expiresAt: null,
    adminUserOwner: null,
  };

  if (existing) {
    await apiTokenStore.update({ where: { id: existing.id }, data });
  } else {
    await apiTokenStore.create({ data });
  }
}
