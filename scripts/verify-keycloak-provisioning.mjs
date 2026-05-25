import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const read = (...parts) => readFileSync(join(root, ...parts), "utf8");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertIncludes = (source, value, label) => {
  assert(source.includes(value), `${label} must include ${value}`);
};

const findBy = (items, key, value, label) => {
  assert(Array.isArray(items), `${label} must be an array`);

  const item = items.find((candidate) => candidate?.[key] === value);
  assert(item, `${label} must include ${value}`);

  return item;
};

const realm = JSON.parse(
  read("idp", "keycloak", "import", "idambox-realm.json"),
);
const rootPackage = JSON.parse(read("package.json"));
const rootReadme = read("README.md");
const backendEnvExample = read("apps", "backend", ".env.example");
const backendReadme = read("apps", "backend", "README.md");
const idpReadme = read("idp", "README.md");
const configSource = read("apps", "backend", "src", "keycloak", "config.ts");
const adminClientSource = read(
  "apps",
  "backend",
  "src",
  "keycloak",
  "admin-client.ts",
);
const provisionSource = read(
  "apps",
  "backend",
  "src",
  "keycloak",
  "provision-idambox-user.ts",
);
const registerSource = read(
  "apps",
  "backend",
  "src",
  "keycloak",
  "register-idambox-user-provisioning.ts",
);
const indexSource = read("apps", "backend", "src", "index.ts");

assert(realm.realm === "idambox", "Provisioning realm must be idambox");

const adminClient = findBy(
  realm.clients,
  "clientId",
  "idambox-strapi-admin",
  "Realm clients",
);
assert(
  adminClient.name === "IdamBox Strapi Admin API",
  "Strapi admin client name must match",
);
assertIncludes(
  adminClient.description ?? "",
  "Local-only",
  "Strapi admin client description",
);
assert(
  adminClient.protocol === "openid-connect",
  "Strapi admin client protocol must be OpenID Connect",
);
assert(
  adminClient.publicClient === false,
  "Strapi admin client must be confidential",
);
assert(
  adminClient.clientAuthenticatorType === "client-secret",
  "Strapi admin client must use client secret auth",
);
assert(
  adminClient.secret === "idambox-strapi-admin-local-secret",
  "Strapi admin client secret must match local value",
);
assert(
  adminClient.standardFlowEnabled === false,
  "Strapi admin client must disable standard flow",
);
assert(
  adminClient.implicitFlowEnabled === false,
  "Strapi admin client must disable implicit flow",
);
assert(
  adminClient.directAccessGrantsEnabled === false,
  "Strapi admin client must disable direct grants",
);
assert(
  adminClient.serviceAccountsEnabled === true,
  "Strapi admin client must enable service accounts",
);
assert(
  adminClient.authorizationServicesEnabled === false,
  "Strapi admin client must disable authorization services",
);
assert(
  Array.isArray(adminClient.redirectUris) &&
    adminClient.redirectUris.length === 0,
  "Strapi admin client must not define redirect URIs",
);
assert(
  Array.isArray(adminClient.webOrigins) && adminClient.webOrigins.length === 0,
  "Strapi admin client must not define web origins",
);

const serviceAccount = findBy(
  realm.users,
  "serviceAccountClientId",
  "idambox-strapi-admin",
  "Realm service accounts",
);
const realmManagementRoles =
  serviceAccount.clientRoles?.["realm-management"] ?? [];
for (const role of ["view-users", "query-users", "manage-users"]) {
  assert(
    realmManagementRoles.includes(role),
    `Strapi service account must include ${role}`,
  );
}

for (const source of [
  backendEnvExample,
  backendReadme,
  idpReadme,
  rootReadme,
]) {
  assertIncludes(source, "IDAMBOX_KEYCLOAK_PROVISIONING", "Provisioning docs");
  assertIncludes(source, "KEYCLOAK_BASE_URL", "Provisioning docs");
  assertIncludes(source, "KEYCLOAK_REALM", "Provisioning docs");
  assertIncludes(source, "KEYCLOAK_ADMIN_CLIENT_ID", "Provisioning docs");
  assertIncludes(source, "KEYCLOAK_ADMIN_CLIENT_SECRET", "Provisioning docs");
  assertIncludes(source, "idambox-strapi-admin", "Provisioning docs");
  assertIncludes(
    source,
    "idambox-strapi-admin-local-secret",
    "Provisioning docs",
  );
  assertIncludes(source, "local-only", "Provisioning docs");
}

assertIncludes(
  backendReadme,
  "IDAMBOX_KEYCLOAK_PROVISIONING=true",
  "Backend provisioning docs",
);
assertIncludes(
  backendReadme,
  "blocks the Strapi user save",
  "Backend provisioning docs",
);
assertIncludes(idpReadme, "docker compose down -v", "IDP provisioning docs");
assertIncludes(
  rootReadme,
  "verify:keycloak-provisioning",
  "Root verification docs",
);

for (const source of [
  configSource,
  adminClientSource,
  provisionSource,
  registerSource,
]) {
  assert(
    !source.includes("admin/admin"),
    "Backend provisioning source must not use admin/admin",
  );
}

assertIncludes(
  configSource,
  "IDAMBOX_KEYCLOAK_PROVISIONING",
  "Keycloak config",
);
assertIncludes(configSource, "KEYCLOAK_BASE_URL", "Keycloak config");
assertIncludes(configSource, "KEYCLOAK_REALM", "Keycloak config");
assertIncludes(configSource, "KEYCLOAK_ADMIN_CLIENT_ID", "Keycloak config");
assertIncludes(configSource, "KEYCLOAK_ADMIN_CLIENT_SECRET", "Keycloak config");
assertIncludes(
  adminClientSource,
  "/protocol/openid-connect/token",
  "Keycloak admin client",
);
assertIncludes(adminClientSource, "/admin/realms/", "Keycloak admin client");
assertIncludes(
  provisionSource,
  "externalSubject",
  "Keycloak provisioning source",
);
assertIncludes(
  provisionSource,
  "UPDATE_PASSWORD",
  "Keycloak provisioning source",
);
assertIncludes(
  provisionSource,
  "password: null",
  "Keycloak provisioning source",
);
assertIncludes(
  provisionSource,
  "strapi.db.query(IDAMBOX_USER_UID).update",
  "Keycloak provisioning source",
);
assertIncludes(
  provisionSource,
  "findUserByEmail",
  "Keycloak provisioning source",
);
assertIncludes(
  registerSource,
  "strapi.documents.use",
  "Keycloak provisioning middleware",
);
assertIncludes(
  registerSource,
  "api::idambox-user.idambox-user",
  "Keycloak provisioning middleware",
);
assertIncludes(
  indexSource,
  "registerIdamboxUserProvisioning",
  "Strapi index provisioning registration",
);

assert(
  rootPackage.scripts?.["verify:keycloak-provisioning"] ===
    "node scripts/verify-keycloak-provisioning.mjs",
  "package.json must define verify:keycloak-provisioning",
);

console.log("IdamBox Keycloak provisioning verification passed");
