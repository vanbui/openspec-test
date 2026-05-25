import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertIncludes = (source, value, label) => {
  assert(source.includes(value), `${label} must include ${value}`);
};

const assertArrayIncludes = (source, value, label) => {
  assert(Array.isArray(source), `${label} must be an array`);
  assert(source.includes(value), `${label} must include ${value}`);
};

const findBy = (items, key, value, label) => {
  assert(Array.isArray(items), `${label} must be an array`);

  const item = items.find((candidate) => candidate?.[key] === value);
  assert(item, `${label} must include ${value}`);

  return item;
};

const compose = read('idp', 'docker-compose.yml');
const realm = JSON.parse(read('idp', 'keycloak', 'import', 'idambox-realm.json'));
const rootReadme = read('README.md');
const idpReadme = read('idp', 'README.md');
const packageJson = JSON.parse(read('package.json'));

const assertCredential = (user, expectedPassword, label) => {
  const credential = user.credentials?.find((candidate) => candidate.type === 'password');

  assert(credential, `${label} must include a password credential`);
  assert(credential.value === expectedPassword, `${label} password must be ${expectedPassword}`);
  assert(credential.temporary === false, `${label} password must be non-temporary`);
};

assertIncludes(compose, 'keycloak:', 'Docker Compose service');
assertIncludes(compose, 'quay.io/keycloak/keycloak:26.6.1', 'Docker Compose image');
assertIncludes(compose, 'start-dev', 'Docker Compose command');
assertIncludes(compose, '--import-realm', 'Docker Compose command');
assertIncludes(compose, '"127.0.0.1:8080:8080"', 'Docker Compose port binding');
assertIncludes(compose, 'KC_BOOTSTRAP_ADMIN_USERNAME: admin', 'Docker Compose admin username');
assertIncludes(compose, 'KC_BOOTSTRAP_ADMIN_PASSWORD: admin', 'Docker Compose admin password');
assertIncludes(compose, 'keycloak_data:/opt/keycloak/data', 'Docker Compose data volume');
assertIncludes(compose, './keycloak/import:/opt/keycloak/data/import:ro', 'Docker Compose import mount');
assertIncludes(compose, 'keycloak_data:', 'Docker Compose named volume');

assert(realm.realm === 'idambox', 'Realm name must be idambox');
assert(realm.enabled === true, 'Realm must be enabled');
assert(realm.displayName === 'IdamBox', 'Realm display name must be IdamBox');
assert(realm.registrationAllowed === false, 'Realm registration must be disabled');
assert(realm.resetPasswordAllowed === false, 'Realm password reset must be disabled');
assert(realm.rememberMe === true, 'Realm rememberMe must be enabled');
assert(realm.loginWithEmailAllowed === true, 'Realm must allow login with email');
assert(realm.duplicateEmailsAllowed === false, 'Realm duplicate emails must be disabled');
assert(realm.verifyEmail === false, 'Realm email verification must be disabled for local users');

const jane = findBy(realm.users, 'email', 'jane.doe@idambox.com', 'Realm users');
assert(jane.username === 'jane.doe@idambox.com', 'Jane username must match email');
assert(jane.emailVerified === true, 'Jane email must be verified');
assert(jane.enabled === true, 'Jane user must be enabled');
assert(Array.isArray(jane.requiredActions) && jane.requiredActions.length === 0, 'Jane must have no required actions');
assertCredential(jane, 'jane', 'Jane');

const bob = findBy(realm.users, 'email', 'bob.doe@idambox.com', 'Realm users');
assert(bob.username === 'bob.doe@idambox.com', 'Bob username must match email');
assert(bob.emailVerified === true, 'Bob email must be verified');
assert(bob.enabled === true, 'Bob user must be enabled');
assert(Array.isArray(bob.requiredActions) && bob.requiredActions.length === 0, 'Bob must have no required actions');
assertCredential(bob, 'bob', 'Bob');

const csrmClient = findBy(realm.clients, 'clientId', 'idambox-csrm', 'Realm clients');
assert(csrmClient.name === 'IdamBox CSRM', 'CSRM client name must be IdamBox CSRM');
assertIncludes(csrmClient.description ?? '', 'Local-only', 'CSRM client description');
assert(csrmClient.protocol === 'openid-connect', 'CSRM client protocol must be OpenID Connect');
assert(csrmClient.publicClient === false, 'CSRM client must be confidential');
assert(csrmClient.clientAuthenticatorType === 'client-secret', 'CSRM client must use client secret auth');
assert(csrmClient.secret === 'idambox-csrm-local-secret', 'CSRM client secret must match local value');
assert(csrmClient.standardFlowEnabled === true, 'CSRM client must enable standard flow');
assert(csrmClient.implicitFlowEnabled === false, 'CSRM client must disable implicit flow');
assert(csrmClient.directAccessGrantsEnabled === false, 'CSRM client must disable direct grants');
assert(csrmClient.serviceAccountsEnabled === false, 'CSRM client must disable service accounts');
assert(csrmClient.authorizationServicesEnabled === false, 'CSRM client must disable authorization services');
assertArrayIncludes(
  csrmClient.redirectUris,
  'http://localhost:3000/api/auth/callback/keycloak',
  'CSRM redirect URIs',
);
assertArrayIncludes(csrmClient.webOrigins, 'http://localhost:3000', 'CSRM web origins');
assert(
  csrmClient.attributes?.['post.logout.redirect.uris'] === 'http://localhost:3000',
  'CSRM post logout redirect must be localhost:3000',
);
assert(csrmClient.attributes?.['pkce.code.challenge.method'] === 'S256', 'CSRM client must require PKCE S256');

for (const scope of ['web-origins', 'acr', 'profile', 'roles', 'email']) {
  assertArrayIncludes(csrmClient.defaultClientScopes, scope, 'CSRM default scopes');
}

assert(!Array.isArray(realm.groups) || realm.groups.length === 0, 'Realm must not define CSRM authorization groups');

const realmRoles = realm.roles?.realm ?? [];
const hasCsrmRealmRole = Array.isArray(realmRoles)
  && realmRoles.some((role) => /csrm|security analyst|entitlement/i.test(role?.name ?? ''));
assert(!hasCsrmRealmRole, 'Realm must not define CSRM authorization realm roles');

for (const source of [rootReadme, idpReadme]) {
  assertIncludes(source, 'local-only', 'Keycloak docs');
  assertIncludes(source, 'http://localhost:8080/admin', 'Keycloak docs');
  assertIncludes(source, 'http://localhost:8080/realms/idambox', 'Keycloak docs');
  assertIncludes(source, 'http://localhost:8080/realms/idambox/.well-known/openid-configuration', 'Keycloak docs');
  assertIncludes(source, 'idambox-csrm', 'Keycloak docs');
  assertIncludes(source, 'idambox-csrm-local-secret', 'Keycloak docs');
  assertIncludes(source, 'jane.doe@idambox.com', 'Keycloak docs');
  assertIncludes(source, 'bob.doe@idambox.com', 'Keycloak docs');
  assertIncludes(source, 'docker compose down -v', 'Keycloak docs');
  assertIncludes(source, 'Auth0', 'Keycloak docs');
  assertIncludes(source, 'Ping Access Management', 'Keycloak docs');
  assertIncludes(source, 'Okta', 'Keycloak docs');
  assertIncludes(source, 'Entra ID', 'Keycloak docs');
  assertIncludes(source, 'IdamBoxUser -> Role -> Entitlement -> Application', 'Keycloak docs');
}

assertIncludes(rootReadme, 'cd idp', 'Root README Keycloak quickstart');
assertIncludes(rootReadme, 'docker compose up -d', 'Root README Keycloak quickstart');
assertIncludes(rootReadme, 'does not wire Next.js login', 'Root README auth boundary');
assertIncludes(idpReadme, 'docker compose logs -f keycloak', 'IDP README quickstart');
assertIncludes(idpReadme, 'Keycloak startup import skips', 'IDP README import behavior');
assertIncludes(idpReadme, 'do not add CSRM authorization roles or groups', 'IDP README authorization boundary');

assert(
  packageJson.scripts?.['verify:keycloak-idp'] === 'node scripts/verify-keycloak-idp.mjs',
  'package.json must define verify:keycloak-idp',
);

console.log('IdamBox Keycloak IDP verification passed');
