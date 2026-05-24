import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const readSchema = (apiName, contentTypeName = apiName) => {
  const path = join(
    root,
    'apps',
    'backend',
    'src',
    'api',
    apiName,
    'content-types',
    contentTypeName,
    'schema.json',
  );
  return JSON.parse(readFileSync(path, 'utf8'));
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const application = readSchema('application');
const entitlement = readSchema('entitlement');
const role = readSchema('role');
const idamboxUser = readSchema('idambox-user');

assert(application.kind === 'collectionType', 'Application must be a collection type');
assert(entitlement.kind === 'collectionType', 'Entitlement must be a collection type');
assert(role.kind === 'collectionType', 'Role must be a collection type');
assert(idamboxUser.kind === 'collectionType', 'IdamBox User must be a collection type');

assert(entitlement.attributes.name?.required === true, 'Entitlement name must be required');
assert(entitlement.attributes.description?.type === 'text', 'Entitlement description must be text');

assert(
  application.attributes.entitlements?.target === 'api::entitlement.entitlement',
  'Application must relate to entitlements',
);
assert(
  entitlement.attributes.application?.target === 'api::application.application',
  'Entitlement must relate to application',
);
assert(entitlement.attributes.application?.required === true, 'Entitlement application must be required');
assert(
  role.attributes.entitlements?.target === 'api::entitlement.entitlement',
  'Role must bundle entitlements',
);
assert(idamboxUser.attributes.roles?.target === 'api::role.role', 'IdamBox User must relate to roles');
assert(role.attributes.idamboxUsers?.target === 'api::idambox-user.idambox-user', 'Role must relate to users');

console.log('IdamBox core model verification passed');
