import type { Core } from "@strapi/strapi";

type AdvancedSettings = Record<string, unknown>;

/**
 * Users-permissions registration is disabled at every boot, unconditionally
 * (D-37). CSRM holds no users-permissions accounts: the web reaches this API
 * with its token and IdamBox identities, so an open registration route could
 * only mint accounts nothing in the application recognises. The plugin's own
 * bootstrap seeds `allow_register: true` once and never revisits the value, so
 * this step runs after it and rewrites the setting whenever it is anything but
 * false. POST /api/auth/local and GET /api/users/me stay mounted by the plugin
 * and are recorded as an accepted residual until INT-02.
 */
export async function disableUsersPermissionsRegistration(strapi: Core.Strapi): Promise<void> {
  const store = strapi.store({ type: "plugin", name: "users-permissions" });
  const current = await store.get({ key: "advanced" });
  const settings: AdvancedSettings = typeof current === "object" && current !== null ? (current as AdvancedSettings) : {};
  if (settings.allow_register === false) return;
  await store.set({ key: "advanced", value: { ...settings, allow_register: false } });
  strapi.log.info("CSRM users-permissions registration disabled.");
}
