# Architecture Research

## Boundaries

`apps/web` renders the CSRM experience, holds only browser-appropriate interaction state, and invokes one typed CSRM API/service layer. `apps/strapi` owns persisted data, Keycloak token validation, effective capability resolution, record-level authorization, workflow rules, audit records, import processing, and eventually AI orchestration.

## Core flow

1. Next.js redirects an unauthenticated user through Keycloak's authorization-code flow.
2. The web application establishes a secure session and sends an access token to Strapi.
3. Strapi resolves the implicit Requestor grant plus explicit roles, functions, and FunctionAPI mappings before authorizing an operation and record.
4. Typed web services render backend resources and workflow states. AI-related actions create or observe asynchronous work, never directly release an assessment.

## Build order implications

Create the monorepo, design system, API boundary, permissions, tests, and responsive shell first. Then deliver the primary vertical workflow in dependency order: request → questionnaire → assessment/release → register → administration → dashboards; finally replace development adapters with integrated Keycloak, Strapi APIs, AI jobs, and hardening.
