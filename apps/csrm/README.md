# CSRM Web

The Next.js App Router workspace for the IdamBox Cyber Risk Manager.

Production data access belongs in server-only feature services that use the Strapi OpenAPI contract. UI navigation and development capabilities are optimistic UX only; Strapi remains the authorization boundary.

Set `CSRM_API_BASE_URL` to the Strapi REST base, including its terminal `/api` segment (for example, `http://localhost:1337/api`). It must be an absolute HTTP(S) URL without credentials, query parameters, or a fragment; reverse-proxy prefixes are supported when they end in `/api`.
