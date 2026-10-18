# Pitfalls Research

| Risk | Prevention | Phase |
|---|---|---|
| Treating hidden navigation as authorization | Enforce Role → Function → FunctionAPI and record checks in Strapi; test IDOR denial | 1, 8 |
| Inventing UI-only domain entities or fields | Derive transport/domain mappings from the OpenAPI contract and JDL; document missing APIs | 1–8 |
| Mixing package-manager lockfiles during the Strapi move | Decide root package manager, retain one root lockfile, and validate clean installs | 1 |
| Hard-coding questionnaire fields or AI output | Render persisted definitions and use typed AI/job adapters | 3, 4, 8 |
| Allowing generated drafts to shortcut analyst review | Model queued/generating/completed/failed and separate release from generation | 4, 8 |
| Building desktop tables that merely shrink on mobile | Provide responsive column rules or card/list representations and test target widths | 1–7 |
| CSV imports that silently overwrite data | Preview headers and rows, surface duplicates, require confirmation, and report result rows | 6 |
| Frontend-only permission checks | Treat UI capability visibility as usability only; E2E test server enforcement | 1, 8 |
