# Research Summary: IdamBox Platform

## Stack

Use a Turbo monorepo with Yarn workspaces following `example-projects/edalas-dylan`: `apps/backend` for Strapi and future Next.js modules under `apps/*`.

## Table Stakes

Phase 1 must produce a runnable Strapi backend with custom IdamBox collections for users, roles, applications, and application roles. The relationships must support user access derived through assigned roles and those roles' application roles.

## Watch Out For

Keep Strapi admin users separate from IdamBox users, defer Auth0 until app phases, and avoid fine-grained entitlement modeling until module-specific requirements exist.

## Roadmap Implication

The current v1 scope is a single backend foundation phase. Application frontends and Auth0 integration belong in later milestones or added phases.
