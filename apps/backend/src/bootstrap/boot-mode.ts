/**
 * Process-local boot mode. A backend administration command (for example `scim:token`) boots Strapi
 * without listening, in the same process. It must not run the development seeds or start background
 * workers: they write to the same database as a running server and would race it, and a worker in a
 * short-lived command could claim outbox work it never finishes. This is deliberately not an
 * environment variable, so it can never leak into a server process.
 */
let administrationBoot = false;

export function markAdministrationBoot(): void {
  administrationBoot = true;
}

export function isAdministrationBoot(): boolean {
  return administrationBoot;
}
