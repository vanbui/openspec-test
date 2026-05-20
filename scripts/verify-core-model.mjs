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
const applicationRole = readSchema('application-role');
const role = readSchema('role');
const idamboxUser = readSchema('idambox-user');

assert(application.kind === 'collectionType', 'Application must be a collection type');
assert(applicationRole.kind === 'collectionType', 'Application Role must be a collection type');
assert(role.kind === 'collectionType', 'Role must be a collection type');
assert(idamboxUser.kind === 'collectionType', 'IdamBox User must be a collection type');

assert(applicationRole.attributes.name?.required === true, 'Application Role name must be required');
assert(applicationRole.attributes.description?.type === 'text', 'Application Role description must be text');

assert(
  application.attributes.applicationRoles?.target === 'api::application-role.application-role',
  'Application must relate to application roles',
);
assert(
  applicationRole.attributes.application?.target === 'api::application.application',
  'Application Role must relate to application',
);
assert(applicationRole.attributes.application?.required === true, 'Application Role application must be required');
assert(
  role.attributes.applicationRoles?.target === 'api::application-role.application-role',
  'Role must bundle application roles',
);
assert(idamboxUser.attributes.roles?.target === 'api::role.role', 'IdamBox User must relate to roles');
assert(role.attributes.idamboxUsers?.target === 'api::idambox-user.idambox-user', 'Role must relate to users');

console.log('IdamBox core model verification passed');
