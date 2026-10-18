# Phase 6 Independent Review Findings — Administration and CSV Imports

Source: five-lens adversarial review (authz-security, workflow-correctness, test-integrity, design-a11y, rules-hygiene) over diff range `e1f2a81^..HEAD`, every finding independently re-verified against committed code, plus live browser UAT. 34 confirmed findings, deduplicated below into 21 work items with operator decisions baked in. No checkpoints required — implement exactly as decided here.

## Blockers / Majors

### F1. Test-only `injected ` escape hatch in production commit path
`apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` (~line 316): `(error instanceof Error && /^injected /.test(error.message))` exists solely so harness-thrown errors (strapi-http-harness.ts 803/822/838) are downgraded to per-row rejections. Any real infrastructure failure aborts the whole request instead, so the behavior the tests "verify" is unreachable in production.
**Decision:** Remove the message-prefix match entirely. Production semantics: ANY unexpected `Error` thrown while writing a single row is caught, that row is reported as rejected (stable code e.g. `ROW_WRITE_FAILED`, generic safe message — never echo raw error text), zero partial writes for that row, and the import continues (skip-and-report, consistent with drift semantics). The existing integration tests must then pass through the genuine path with no special-casing. Escape-hatch sweep must come back clean.

### F2. hostingLocation/location 500-char caps break at Strapi entity validator
`administration-query.ts` (~190, 203) allows 500 chars for Information System `hostingLocation` and Information Asset `location`, but these collections persist via `strapi.documents` where schema `string` fields default to a 255 Yup cap. A 256–500 char value passes preview then throws at commit, and with F1 unfixed becomes a fatal 500.
**Decision:** Check the frozen datamodel/contract reference for those two fields' true caps. If the contract says 500, persist Information Systems/Assets through the same trusted repository mechanism Controls use (which accepts the full contract caps) so contract-valid values commit; if the contract says 255, lower server AND web caps to 255. Either way add exact-boundary and cap-plus-one tests at every trust boundary (mutation + CSV preview + commit) and record the outcome in `docs/contract-gaps/phase-06-administration-import-contract.md`.

### F3. Risk Type blank description rejected; persisted description can never be cleared
`administration-workspace.tsx` (~291, 420): risk-types branch initializes `description: '' ` and submits `''`, which server `trimmedText` rejects → generic 400 on create-with-blank-description, and clearing an existing description is impossible. Every other kind maps `''` → null.
**Decision:** Align risk-types with the established nullable-exemption pattern: map `''`/whitespace to null on submit, server accepts null/absent description, clearing persists null. Regression tests: create with blank description succeeds; clear-existing-description persists and survives re-read.

### F4. CSV classification truncated to first 5,000 existing records
`csv-import.ts` classifyRows (~204) `existing.slice(0, CSV_MAX_ROWS)` (mirrored in web `csv-client-parser.ts` ~143) matches natural keys against only the first 5,000 records though collections may hold 65,536. Beyond that, updates misclassify as creates and then fail at commit.
**Decision:** Classify against the FULL fetched record set: build one Map keyed by normalized natural key over all records (CSV_MAX_ROWS bounds the CSV rows only, never the existing-records set). Fix both server and web mirrors. Regression: mounted test with >5,000 existing records (insert cheaply via repository loop) classifying a beyond-window row as update.

### F5. Per-row full-collection rescans during commit
`administration-workflow.ts` commit create path (~300-305) calls `assertNaturalKeyAvailable` per row, each re-fetching up to the entire collection inside the serialized queue — up to 5,000 full scans per import.
**Decision:** Inside the serialized commit, fetch the collection once, build the normalized-key Map, validate/classify all rows against it, and maintain the Map incrementally as rows are written (add created keys). No per-row full fetches. This composes with F4's Map.

### F6. Global multipart bounds regress non-import Strapi endpoints
`apps/strapi/config/middlewares.ts` sets formidable `maxFiles: 1` / 5 MiB `maxTotalFileSize` globally, capping the Strapi admin media library and any other multipart route.
**Decision:** Scope the bounds to the four CSV import routes only (route-level middleware or workflow-level formidable options); restore default global body config. Keep the existing two-file / oversize / unexpected-field zero-write regressions passing against the import routes, and add a unit test locking that the global middleware config carries no file caps.

### F7. Wrong page titles on shared admin routes (WCAG 2.4.2)
`app/(app)/app/admin/[collection]/page.tsx:8` hardcodes `Risk Types | IdamBox CSRM` for all four collections; `[documentId]/page.tsx:11` hardcodes `Risk Type Details`; `new/page.tsx:11` hardcodes `Create Risk Type`. Live-confirmed: `/app/admin/controls` shows "Risk Types | IdamBox CSRM".
**Decision:** Replace with `generateMetadata` deriving from the collection config: list `{Plural} | IdamBox CSRM`, create `Create {Singular} | IdamBox CSRM`, detail `{Singular} Details | IdamBox CSRM`, import `Import {Plural} CSV | IdamBox CSRM`.

### F8. No loading/error boundaries for admin routes; loading state unreachable
No `loading.tsx`/`error.tsx` anywhere under `app/(app)/app/admin/`; the workspace's `state='loading'` skeleton is dead code; search/filter changes give zero pending feedback; any server error crashes to the root boundary.
**Decision:** Add route-level `loading.tsx` and `error.tsx` for the admin segment matching the sibling feature areas' pattern; wire client-side pending state (useTransition around router.replace) so list controls disable and the specced `role=status` "Loading {collection}" announcement renders during in-flight query changes.

### F9. Framework filter drops keystrokes (controlled by URL, no debounce)
`administration-workspace.tsx` ~199: framework Input value comes straight from URL query and onChange calls router.replace per keystroke — React snaps the input back while navigation is in flight. Spec requires 300ms debounce.
**Decision:** Local state for the input value; debounce URL sync at 300ms; apply the identical pattern to the search input for consistency. Unit tests for debounce behavior.

### F10. Yes/no radio groups have no accessible group name
`administration-workspace.tsx` ~398-414: FormLabel htmlFor points at a `<fieldset>` (non-labelable), no `<legend>`; aria-invalid/describedby land on an unnamed fieldset. Screen readers can't distinguish the three identical Yes/No groups.
**Decision:** Give each group a real `<legend>` (visually styled as the existing label) or `aria-labelledby` from the fieldset to the label id; error/description associations must resolve to the named group. Axe/unit regression for group naming.

### F11. Unspecced "Administration shortcuts" strip below lg with fake Sign out
`capability-navigation.tsx` 129-137: permanent header strip duplicating the four admin links plus a "Sign out" button that only does `window.location.assign('/sign-in?returnTo=/app')` without ending any session — on every page below lg for analysts.
**Decision:** Delete the strip entirely. Admin links already live in the drawer's Administration group. Verify the mobile-menu tab-order regression (from `4e0d984`) still passes after removal — the strip's removal must not resurrect that defect. Remove the fake Sign out (role switching remains the dev-fixture mechanism).

## Minors

### F12. Invalid/foreign query params crash admin list pages
`administration-schema.ts`: three of four query schemas are `.strict()` (controls is `.strip()`), and `firstValue` throws on duplicated params — `?utm_source=x` or `?q=a&q=b` crashes the server component. Also `csrm-risk.ts` handleError (~95-102) rethrows AdministrationValidationError from the shared list service, turning invalid canonical queries on GET /v1/risk_types|controls into 500s.
**Decision:** Web: all four schemas `.strip()` unknown keys; duplicated params take the first value; invalid values fall back to defaults instead of throwing. Server: keep strict canonical parsing but map AdministrationValidationError/AdministrationWorkflowError to the bounded 400 envelope in the csrm-risk controller (same mapping the csrm-administration controller uses).

### F13. Preview/results table a11y-state batch (csv-import-flow.tsx)
(a) Step-3 filter toggles expose active state by fill color only → add `aria-pressed` and a not-color-only active treatment. (b) `<Button asChild disabled>` around `Link` is inert on anchors → while busy render genuinely non-navigable controls (conditionally render a disabled button, not an anchor). (c) `<Progress>` with no value renders a static empty track → use proper indeterminate presentation (animated) for validating/importing. (d) File-level validation errors never link to the file input → set `aria-invalid` and extend `aria-describedby` to the error id. (e) Preview/results tables are unpaginated (up to 5,000 `<tr>`) with sideways scroll at 375px → paginate client-side (100 rows/page) and provide the specced sub-768px card presentation consistent with the list pattern.

### F14. Row-state badges neutral + no completion toast
All five row states use the same neutral outline Badge; success fires no toast. **Decision:** map states to semantic badge variants (create→info/success family, update→info, unchanged→muted, rejected→danger, ambiguous→warning) with icon+text preserved, and fire the specced sonner toast "Import complete: N created, M updated, R rejected" on step-5 entry.

### F15. Create CTA variant inconsistent
`administration-workspace.tsx` ~193: accent `default` variant only for risk-types, `outline` for the other three. **Decision:** `default` (filled primary) for Create on all four lists; Import CSV stays outline.

### F16. Applicable Controls combobox ARIA incomplete
~423: `role=combobox` without `aria-expanded`; `aria-controls` references an unmounted listbox when empty. **Decision:** manage `aria-expanded` correctly and only reference the listbox id while mounted (or keep it mounted empty); announce option availability changes.

### F17. Empty states lack required actions
`administration-workspace.tsx` 88-101: filtered-empty lacks a Clear filters control; first-use empty lacks Create CTA. **Decision:** add both actions inside the empty-state panels per spec.

### F18. Unknown collection slug shows permission-denied to authorized analysts
All four admin pages return `AdministrationPermissionState` for a mistyped slug. **Decision:** call Next `notFound()` for unknown slugs; reserve the permission state for genuine capability denial.

### F19. Missing `--color-sidebar-border` token + count formatting + breadcrumbs
(a) `border-sidebar-border` (capability-navigation.tsx:46) has no token in globals.css → divider falls back to currentColor; define the token in the sidebar palette (both themes). (b) Result counts render "2,646 results" in one element and "2646 results" in the density bar → use one locale-formatted representation everywhere. (c) Add the specced breadcrumbs `Administration / {Collection}` (+ `/ Import`, `/ New`, `/ {name}` on subpages) using the installed shadcn breadcrumb primitive.

### F20. Contract/spec + dead scaffolding hygiene
(a) `docs/references/specification.json` (and generated `schema.d.ts`) still document the disabled legacy CRUD paths (`/csrm-risk-types`, `/csrm-controls`, `/csrm-information-systems`, `/csrm-information-assets` incl. DELETE/PUT `/{id}`) though core routers are `only: []` → remove those dead paths from the spec source, regenerate, `api:check` green, confirm zero consumers. (b) Delete `apps/web/scripts/verify-administration-red.mjs` (red-phase verifier that now always fails by design). (c) `scripts/verify-phase-06-integrity.mjs` 187-191 hardcodes `+ 2` for the two csrm-risk-mounted list routes → genuinely parse those routes' auth config so removing their token gates fails the check.

### F21. Import-flow tests bypass the production path; snapshot lacks value-drift coverage
(a) RTL tests drive commit only through test-only props (`previewCsv`/`commitCsv`/`previewRows` with a fabricated all-zero digest); production `previewAction`/`commitAction` path — including its fallback that fabricates a digest — is untested. **Decision:** delete the legacy test-only props and the fallback from `csv-import-flow.tsx`; rewire tests through the production prop shape with mocked server actions; no fabricated digests. (b) Reviewed snapshot stores only `{state, matchedDocumentId}` — concurrent non-key edits between preview and commit are silently overwritten. **Decision:** include the matched record's `updatedAt` in the retained per-row snapshot for update rows and treat a mismatch at commit as `ROW_PREVIEW_DRIFT` (skip-and-report, counted in previewChanged). Mounted regression: preview → concurrent PATCH to the matched record → commit reports drift, concurrent edit preserved. Document in the contract-gaps doc. (c) Document as explicit limitations (no code change, schemas frozen): natural-key uniqueness for systems/assets has no DB-level unique backstop (single-process guarantee via serialized queue), and drift detection is per-row not per-field.

## Constraints (unchanged, non-negotiable)
- Frozen content-type schemas; catalogue copies stay byte-identical; token-only outer gate; typed openapi-fetch services only; semantic tokens only; server-side authorization authoritative; no AI attribution anywhere; real newlines in commit bodies; no hardcoded search literals in tests; RED sentinels/execArgv gates/guards must not survive GREEN.
- Full gate must pass at the end: `apps/strapi npm test`, `apps/web pnpm typecheck && pnpm test && pnpm api:check && pnpm test:e2e` (Node 24.19 PATH prefix).
