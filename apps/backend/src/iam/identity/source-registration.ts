import type { Core } from "@strapi/strapi";
import { runSourceRegistration, type SourceRegistrationManifest } from "./write-context";

/** Trusted registration entry point; no supplied roles, credentials or write flags. */
export function registerIdentitySource(strapi: Core.Strapi, manifest: SourceRegistrationManifest) {
  return runSourceRegistration(strapi, manifest);
}
