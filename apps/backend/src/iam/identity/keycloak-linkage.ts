import type { Core } from "@strapi/strapi";
import { runKeycloakLinkage } from "./write-context";

/** Exact subject/password cleanup capability; ownership and transaction guards still run. */
export function writeKeycloakLinkage(strapi: Core.Strapi, documentId: string, externalSubject: string | null) {
  return runKeycloakLinkage(strapi, documentId, externalSubject);
}
