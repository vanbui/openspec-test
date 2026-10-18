import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { parseEnv } from 'node:util';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(read(path));
const realmPath = 'docker/keycloak/import/idambox-realm.json';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

// Digests cover the complete parsed tree, independent of JSON formatting/key order.
// Assertions print only a digest, never fixture credentials or imported realm data.
function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

async function sourceModule(path) {
  const source = read(path).replace(/^import 'server-only';\s*/m, '');
  const code = stripTypeScriptTypes(source);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

function service(name) {
  const block = read('docker/docker-compose.yaml').match(new RegExp(`^  ${name}:\\n((?:^(?: {4}.*|\\s*)\\n)*)`, 'm'))?.[1];
  assert.ok(block, `compose service ${name} exists`);
  const scalar = (key) => block.match(new RegExp(`^    ${key}: (.+)$`, 'm'))?.[1];
  const ports = block.match(/^    ports:\n((?:^      - .+\n)*)/m)?.[1] ?? '';
  return { image: scalar('image'), ports: [...ports.matchAll(/^      - "([^"]+)"$/gm)].map((match) => match[1]) };
}

test('development realm SMTP uses only the existing internal Mailpit service', () => {
  assert.deepEqual(json(realmPath).smtpServer, {
    host: 'mailpit', port: '1025', from: 'no-reply@idambox.invalid',
    auth: 'false', ssl: 'false', starttls: 'false',
  });
  assert.deepEqual(service('mailpit'), {
    image: 'axllent/mailpit:v1.31.5', ports: ['127.0.0.1:8025:8025'],
  });
  assert.equal(service('keycloak').image, 'quay.io/keycloak/keycloak:26.6.1');
});

test('all pre-existing realm settings remain structurally identical', () => {
  const { smtpServer, ...preserved } = json(realmPath);
  assert.equal(digest(preserved), 'a188f20b089735d171adee97fe8191462b5be06dd811d8ae6264aa2220aa2a0e');
  const client = preserved.clients.find(({ clientId }) => clientId === 'idambox-csrm');
  assert.deepEqual(client.redirectUris, ['http://localhost:3000/api/auth/callback/keycloak']);
  assert.deepEqual(client.webOrigins, ['http://localhost:3000']);
  assert.equal(client.attributes['post.logout.redirect.uris'], 'http://localhost:3000');
});

test('committed example flags remain false', () => {
  const backend = parseEnv(read('apps/backend/.env.example'));
  const csrm = parseEnv(read('apps/csrm/.env.local.example'));
  assert.equal(backend.IDAMBOX_KEYCLOAK_PROVISIONING, 'false');
  assert.equal(backend.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION, 'false');
  assert.equal(csrm.CSRM_AUTH_OIDC_ENABLED, 'false');
});

test('configuration fallbacks remain disabled without reading other environment values', async () => {
  const provisioning = await sourceModule('apps/backend/src/keycloak/config.ts');
  const verification = await sourceModule('apps/backend/src/keycloak/token-verification-config.ts');
  const oidc = await sourceModule('apps/csrm/src/lib/auth/oidc-configuration.ts');
  for (const value of [undefined, '', 'false']) {
    const environment = (flag) => new Proxy({}, { get(_target, key) {
      assert.equal(key, flag, 'disabled configuration reads only its activation flag');
      return value;
    } });
    assert.equal(provisioning.readKeycloakProvisioningConfig(environment('IDAMBOX_KEYCLOAK_PROVISIONING')), null);
    assert.equal(verification.readKeycloakTokenVerificationConfig(environment('IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION')), null);
    assert.equal(oidc.parseOidcEnabledFlag(value), false);
    assert.equal(oidc.assertSessionRuntimeConfiguration(environment('CSRM_AUTH_OIDC_ENABLED')), undefined);
  }
});

test('CSV source headers and source identity fields carry no credentials', async () => {
  assert.deepEqual(read('docker/midpoint/hr/reference.csv').split(/\r?\n/, 1)[0].split(','), [
    'employeeNumber', 'givenName', 'familyName', 'preferredName', 'email', 'username',
    'department', 'jobTitle', 'status', 'startDate', 'endDate',
  ]);
  const input = await sourceModule('apps/backend/src/iam/identity/identity-input.ts');
  const fields = ['username', 'email', 'firstName', 'lastName', 'displayName', 'accountStatus',
    'sourceExternalId', 'employeeNumber', 'department', 'jobTitle'];
  assert.deepEqual([...input.SOURCE_IDENTITY_FIELDS].sort(), [...fields].sort());
  const dto = read('apps/backend/src/iam/identity/identity-input.ts').match(/export type SourceIdentityInput = \{([^}]+)\}/)?.[1];
  assert.ok(dto, 'source DTO exists');
  const properties = [...dto.matchAll(/(?:^|;)\s*(\w+)\??\s*:/g)].map((match) => match[1]);
  assert.deepEqual(properties.sort(), [...fields].sort());
  const valid = { username: 'journey', email: 'journey@idambox.invalid', displayName: 'Journey',
    accountStatus: 'active', sourceExternalId: 'journey' };
  assert.equal(input.parseSourceIdentityInput(valid).ok, true);
  for (const field of ['password', 'credentials', 'temporaryPassword', 'secret', 'token']) {
    assert.deepEqual(input.parseSourceIdentityInput({ ...valid, [field]: 'forbidden' }), { ok: false, code: 'invalidInput' });
  }
});

test('source mappings have no credential paths or credential elements', () => {
  for (const file of ['100-resource-hr-csv', '110-resource-idambox-scim', '140-object-template-hr-person', '150-archetype-hr-person']) {
    const xml = read(`docker/midpoint/objects/${file}.xml`).replace(/<!--[\s\S]*?-->/g, '');
    const tags = [...xml.matchAll(/<\/?([\w:.-]+)(?=[\s/>])/g)].map((match) => match[1]);
    const paths = [...xml.matchAll(/<(?:\w+:)?(?:ref|path)>([^<]+)<\//g)].map((match) => match[1]);
    for (const field of [...tags, ...paths]) {
      assert.equal(/password|credential|secret/i.test(field), false, `${file} has no credential mapping`);
    }
  }
});

test('the disable-only outbox schema remains frozen', () => {
  const outbox = json('apps/backend/src/api/keycloak-sync-outbox/content-types/keycloak-sync-outbox/schema.json');
  assert.deepEqual(outbox.attributes.operation.enum, ['disableAndEndSessions']);
  assert.equal(digest(outbox), 'c7ac249dbf61868d5f285aeff785e2e97265934be3ab8426933249a9cc6e8f8f');
});
