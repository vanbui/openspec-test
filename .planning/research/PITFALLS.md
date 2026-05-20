# Pitfalls Research: IdamBox Platform Foundation

## Pitfall: Confusing Strapi Admin Users With Product Users

Warning signs:
- Product roles are attached to Strapi admin accounts.
- Future Auth0 identities have nowhere clean to map.

Prevention:
- Create a custom IdamBox user collection from the start.
- Treat Strapi admin authentication as content administration only.

## Pitfall: Overbuilding Permissions Too Early

Warning signs:
- Application roles become action-level permissions before any module exists.
- The backend accumulates speculative permission strings.

Prevention:
- Keep application roles to `name` and `description` for Phase 1.
- Add fine-grained permissions only when a concrete app phase needs them.

## Pitfall: Role Relationship Ambiguity

Warning signs:
- Users directly receive application roles and roles also contain application roles.
- It becomes unclear which source of access wins.

Prevention:
- Phase 1 should model one clear path: users receive roles, roles contain application roles.

## Pitfall: Monorepo Layout Drift

Warning signs:
- Backend is placed at the root while future apps are planned under `apps/*`.
- Shared config is duplicated across modules.

Prevention:
- Start with the `apps/backend` layout from the closest example.
