import type { Core } from '@strapi/strapi';

import { CORS_ALLOWED_ORIGINS_VARIABLE, parseCorsAllowedOrigins } from '../src/utils/cors-allowed-origins';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => [
  'global::scim-request-logger',
  'strapi::errors',
  'global::scim-boundary',
  'global::csrm-development-identity',
  'global::csrm-keycloak-identity',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // R-08-11: Strapi's default echoes any origin with credentials, the admin panel's access-token
      // route included. No browser needs cross-origin access here, so only the origins listed in
      // CSRM_CORS_ALLOWED_ORIGINS are granted, and by default that list is empty. An empty list
      // (never an undefined one, which Strapi reads as a wildcard) grants no origin.
      origin: parseCorsAllowedOrigins(env(CORS_ALLOWED_ORIGINS_VARIABLE, '')),
    },
  },
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '6mb',
      formidable: {
        maxFileSize: 52_428_800,
        maxTotalFileSize: 262_144_000,
      },
    },
  },
  // D-11, D-25: removes every multipart part's temporary file after every request, refused callers included.
  'global::csrm-multipart-cleanup',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
