# IdamBox Platform

IdamBox is the shared platform foundation for BProton application modules such as IdamBox IAM, IdamBox Compliance, IdamBox Automation, IdamBox Crypto Manager, IdamBox LMS, and IdamBox Cyber Risk Manager.

Phase 1 contains only the shared Strapi backend. Future application modules will be added as separate Next.js apps under `apps/*`.

## Workspace

This repository follows the closest provided example project shape:

- `apps/backend` - Strapi backend
- `apps/*` - future Next.js application modules
- `packages/*` - future shared packages

The workspace uses Yarn workspaces and Turbo.

## Prerequisites

- Node.js 18 through 22
- Yarn 1.22.x

## Setup

```powershell
yarn install
Copy-Item apps/backend/.env.example apps/backend/.env
```

Before running Strapi, replace the placeholder secrets in `apps/backend/.env`.

## Development

Run the Strapi backend:

```powershell
yarn develop:cms
```

Strapi runs on `http://localhost:1337` by default. The admin panel is available at `http://localhost:1337/admin`.

## Core Data Model

Phase 1 implements this access model:

```text
IdamBoxUser -> Role -> Entitlement -> Application
```

- `IdamBoxUser` is a custom product user collection, separate from Strapi admin users.
- `Role` is a reusable bundle assigned to one or more IdamBox users.
- `Entitlement` is a permission defined by one application, such as `LMS STUDENT` or `LMS TUTOR`.
- `Application` represents an IdamBox module such as IAM, LMS, or Cyber Risk Manager.

## Authentication Boundary

Phase 1 uses native Strapi admin authentication only, so administrators can create and edit records in Strapi.

Auth0 authentication for end users is intentionally deferred until Next.js application modules are added.

## Verification

Run the static schema verification:

```powershell
yarn verify:schema
```

After dependencies are installed, also run:

```powershell
yarn check-types
yarn build
```
