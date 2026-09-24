# Research Summary

The implementation should be a pnpm/Turborepo monorepo with Strapi retained as the authoritative CSRM API and a Next.js App Router client. The critical architectural rule is a single typed client-to-Strapi service boundary, backed by Keycloak identity and Strapi-enforced effective CSRM authorization.

The delivery plan must prioritise one controlled vertical workflow instead of empty screens: request creation and submission, questionnaire completion, analyst assessment/risk editing, release, and Requestor read-only viewing. Reusable design, status, permission, list, import, and test primitives make that workflow safe to expand into the Risk Register and administration.

Key risks are authorization bypass/IDOR, contract drift, unsafe AI automation, nested-repository/package-manager migration mistakes, and desktop-first UX that fails on mobile. Each has an explicit roadmap phase and verification path.
