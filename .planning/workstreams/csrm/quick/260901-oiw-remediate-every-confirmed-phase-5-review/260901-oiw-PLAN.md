---
phase: quick
plan: 260901-oiw
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/strapi/src/api/csrm-risk/services/risk-register.ts
  - apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
  - apps/strapi/tests/risk-register.unit.test.ts
  - apps/strapi/tests/risk-register.integration.test.ts
  - apps/strapi/tests/risk-register-seed.integration.test.ts
  - apps/web/app/(app)/app/risks/page.tsx
  - apps/web/app/(app)/app/risks/loading.tsx
  - apps/web/app/(app)/app/risks/[documentId]/page.tsx
  - apps/web/src/features/risks/risk-actions.ts
  - apps/web/src/features/risks/risk-service.ts
  - apps/web/src/features/risks/risk-schema.ts
  - apps/web/src/features/risks/risk-register-filters.tsx
  - apps/web/src/features/risks/risk-register.tsx
  - apps/web/src/features/risks/risk-register-loading.tsx
  - apps/web/src/features/risks/risk-detail-editor.tsx
  - apps/web/src/features/risks/risk-details.tsx
  - apps/web/src/features/risks/mitigation-control-list.tsx
  - apps/web/src/features/risks/risk-service.test.ts
  - apps/web/src/features/risks/risk-register-page.test.tsx
  - apps/web/src/features/risks/risk-register.test.tsx
  - apps/web/src/features/risks/risk-details.test.tsx
  - apps/web/e2e/risk-register-workflow.spec.ts
  - apps/web/playwright.config.ts
autonomous: true
requirements:
  - RISK-01
  - RISK-02
must_haves:
  truths:
    - Every numbered finding 1 through 18 has an explicit fixed, duplicate-of, already-correct, or not-applicable disposition backed by current-tree evidence; duplicate pairs 3/9, 7/11, and 8/18 remain individually traceable.
    - Register list and detail apply one fail-closed parent-assessment disclosure rule, so no row links to a deliberately undisclosable partial-release or closed aggregate.
    - Reseeding the mutable fixture never resets analyst-selected Risk or mitigation-control relations and never repurposes an arbitrary analyst-created Control implementation.
    - Every relation filter is a labelled, bounded, server-backed searchable combobox that preserves an active URL-selected label even when it is outside the current result page; loading keeps canonical URL values visible and disabled.
    - Saving an unrelated Risk or mitigation field cannot clear an off-page selected relation, and newly searched owners render immediately after a successful save.
    - Risk and mitigation editing preserve the contracted section headings, keyboard focus enters and exits inline forms predictably, removal restores focus to a surviving anchor, and immutable empty mitigation copy preserves its heading.
    - The Risk Register E2E journey is safe across Playwright retries and reused persisted state, and two consecutive complete E2E suite runs pass on Playwright-owned 1338/3100 services.
    - Content-type schemas remain byte-for-byte unchanged, the source and Strapi catalogue copies remain untouched and byte-identical, no dependency is added, and no live service on 1337/3000 is touched.
  artifacts:
    - path: apps/strapi/src/api/csrm-risk/services/risk-register.ts
      provides: Shared list/detail parent disclosure predicate and repository filtering
    - path: apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
      provides: Creation-only mutable fixture relations without analyst-state normalization
    - path: apps/web/src/features/risks/risk-register-filters.tsx
      provides: Searchable relation filters with honest selected labels and canonical URL updates
    - path: apps/web/src/features/risks/risk-detail-editor.tsx
      provides: Lossless relation editing and immediate searched-owner projection
    - path: apps/web/e2e/risk-register-workflow.spec.ts
      provides: Retry-safe, rerun-safe full-stack Risk Register acceptance journey
    - path: .planning/quick/260901-oiw-remediate-every-confirmed-phase-5-review/260901-oiw-SUMMARY.md
      provides: Numbered 1-through-18 disposition, regression, and commit ledger
  key_links:
    - from: apps/strapi/src/api/csrm-risk/services/risk-register.ts
      to: GET /api/v1/risks and GET /api/v1/risks/{riskId}
      via: one SQL-compatible parent eligibility rule applied before count, pagination, hydration, and detail projection
      pattern: assessmentStatus
    - from: apps/web/src/features/risks/risk-register-filters.tsx
      to: apps/web/src/features/risks/risk-actions.ts
      via: debounced server-backed relation search retaining selected URL labels
      pattern: search
    - from: apps/web/src/features/risks/risk-detail-editor.tsx
      to: apps/web/src/features/risks/risk-actions.ts
      via: changed-field-only mutation using selected relation objects rather than capped initial inventories
      pattern: selectedOwners
    - from: apps/web/e2e/risk-register-workflow.spec.ts
      to: apps/web/playwright.config.ts
      via: persisted-state-safe A/B edits on isolated 1338/3100 servers and collision-resistant temporary database paths
      pattern: 1338
---

<objective>
Remediate every adversarially confirmed Phase 5 review finding, retaining an individual evidence trail for all 18 entries and transparently grouping only exact duplicate reports.

Purpose: Restore consistent Risk disclosure, preserve analyst edits, satisfy the approved searchable-filter and accessibility contracts, and make the complete browser journey recoverable across retries and deterministic across consecutive executions.
Output: Focused conventional atomic commits, direct regression coverage, unchanged frozen schemas and catalogue bytes, a numbered finding ledger, the exact full Strapi/web gate, and two consecutive green E2E suite runs.
</objective>

<execution_context>
@gsd-core/workflows/execute-plan.md
@gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/05-risk-register-and-mitigation-management/05-REVIEW-FINDINGS.md
@.planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md
@.planning/phases/05-risk-register-and-mitigation-management/05-VALIDATION.md
@docs/CSRM-PROJECT-BRIEF.md
@docs/references/specification.json
@docs/references/idambox-datamodel.jdl
@docs/references/idambox-csrm-role-function-api-catalogue.json
@apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json

Preserve Strapi as the production API boundary, the typed web service layer, strict TypeScript, JDL terminology, server-side authorization, semantic tokens, responsive behavior, and human-controlled release. The approved UI spec is binding for relation comboboxes, URL state, loading persistence, section structure, focus restoration, immutable empty copy, and icon sizing.
</context>

<preflight>
Before editing, record the current branch, Node version, `git rev-parse HEAD`, and `git status --short`; remain on the current branch and preserve all user-owned dirty/untracked files, especially `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `.planning/debug/`, `apps/web/.tmp/`, and the untracked findings dossier. Record SHA-256 hashes plus a byte comparison for `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`, and record a path-plus-hash inventory for every `apps/strapi/src/api/**/content-types/**/schema.json`. Do not stage unrelated files, install dependencies, edit generated API output except transiently through `api:check`, weaken/delete/skip/focus tests, add sentinels or environment/process escape hatches, amend or rewrite history, or push. Do not kill, bind, or reuse live ports 1337/3000; Playwright alone owns 1338/3100 and its isolated database. Do not start Phase 6, update ROADMAP phase status, or mark Phase 5 complete.
</preflight>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Align backend disclosure and preserve mutable fixture relations</name>
  <files>apps/strapi/src/api/csrm-risk/services/risk-register.ts, apps/strapi/src/bootstrap/seed-risk-register-workflow.ts, apps/strapi/tests/risk-register.unit.test.ts, apps/strapi/tests/risk-register.integration.test.ts, apps/strapi/tests/risk-register-seed.integration.test.ts</files>
  <behavior>
    - Findings 6 and 17: Risks whose parent is closed or has an incomplete/partial release fact are absent from list counts, pages, hydration, and selected results exactly as they are unavailable from detail; draft/in-review parents without release facts and completely released parents retain current behavior.
    - Findings 8 and 18 (duplicate pair): A second seed run preserves analyst-changed riskOwner, treatmentOwner, riskType, impacted system/asset, control, and controlOwner values; it neither selects nor rewrites an arbitrary first Control implementation after the managed fixture implementation is removed.
    - Existing exact-human authorization, semantic/null-last sorting, filters-before-pagination, bounded hydration, complete release checks, and triple development seed gates remain unchanged.
  </behavior>
  <action>Write failing unit and mounted integration regressions first. Extract one fail-closed parent-disclosure predicate with explicit mutable and complete-release cases, and apply its SQL-equivalent restriction inside the shared repository query before both count and ordered page selection so list and detail cannot diverge; do not infer release from status alone or disclose partial approval facts. Update the seed reconciler so editable Risk and ControlImplementation relations are assigned only when the managed records are first created. On reseed, repair only non-workflow presentation data expressly allowed by the existing seed contract; identify any managed implementation by a stable managed identity rather than `findMany limit 1`, and never repoint, recreate over, or mutate an analyst-created replacement. Preserve serialization and stable-key concurrency behavior. Commit this backend concern atomically with a conventional subject such as `fix(strapi): align risk register disclosure` and an actual multiline body containing real newline characters.</action>
  <verify>
    <automated>cd apps/strapi &amp;&amp; npm test</automated>
  </verify>
  <done>Findings 6, 8, 17, and 18 have direct regressions; list/detail disclosure is identical for every parent state; reseed leaves all analyst-owned relation choices untouched; the Strapi suite passes; the backend commit contains only this concern.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Make relation filters searchable and detail editing lossless and accessible</name>
  <files>apps/web/app/(app)/app/risks/page.tsx, apps/web/app/(app)/app/risks/loading.tsx, apps/web/app/(app)/app/risks/[documentId]/page.tsx, apps/web/src/features/risks/risk-actions.ts, apps/web/src/features/risks/risk-service.ts, apps/web/src/features/risks/risk-schema.ts, apps/web/src/features/risks/risk-register-filters.tsx, apps/web/src/features/risks/risk-register.tsx, apps/web/src/features/risks/risk-register-loading.tsx, apps/web/src/features/risks/risk-detail-editor.tsx, apps/web/src/features/risks/risk-details.tsx, apps/web/src/features/risks/mitigation-control-list.tsx, apps/web/src/features/risks/risk-service.test.ts, apps/web/src/features/risks/risk-register-page.test.tsx, apps/web/src/features/risks/risk-register.test.tsx, apps/web/src/features/risks/risk-details.test.tsx</files>
  <behavior>
    - Findings 3 and 9 (duplicate pair): Owner filters have no literal seed search and can find a non-Doe active user through the authorised server search.
    - Findings 7 and 11 (duplicate pair): Every URL-selected owner, assessment, system, or asset label remains the visible combobox selection even when absent from the current bounded search response.
    - Finding 10: Risk owner, Treatment owner, Related assessment, Impacted system, and Impacted asset use labelled server-backed searchable combobox interactions with expanded/active-option semantics, loading feedback, no-results feedback, keyboard selection, and focus preservation; no first-100 fixed native-select ceiling remains.
    - Finding 12: Both Suspense and segment loading render the canonical current URL query, including both date bounds and active relation labels/chips, with controls disabled rather than reset.
    - Findings 4 and 5: Current control owner/system/asset selections are always merged into editor options, unchanged off-page relations are omitted from mutation deltas rather than normalized to null, and a searched owner selected during editing renders immediately after save and remains selected on reopen.
    - Findings 13 through 16: Overdue uses an explicit grid-aligned icon size; released empty mitigations keep the `No mitigation controls added` heading; focus moves into Edit/Add forms on entry and to a surviving logical anchor after save/cancel/remove; Risk edit mode preserves the three `Risk statement and classification`, `Ratings`, and `Ownership and treatment` sections and heading outline.
  </behavior>
  <action>Add focused component/page/service tests before production edits. Replace fixed relation `<select>` inventories with one reusable controlled relation-combobox pattern built from installed shadcn/Radix primitives; wire each relation type through a server action and typed Strapi service search, using the existing authorised operation for users and the existing authorised typed collection/search boundaries for assessments, systems, and assets. Keep calls bounded, validate every external payload with the existing closed schemas, debounce/cancel stale queries, and do not add a frontend API facade, raw component fetch, dependency, generic unauthorised collection read, catalogue entry, schema field, or invented domain entity. Merge `meta.selectedLabels` into initial/current options with `mergeSelectedRiskPickerOption`, and keep selected options across subsequent searches. Replace both default-query loading paths with a query-aware client loading composition that derives only canonical values from `useSearchParams`, displays current chips/date values, and disables all controls without making protected picker requests. In Risk detail composition, merge every currently selected owner/system/asset and each implementation controlOwner into its applicable options before rendering. Change post-save relation projection to resolve against the live selected-relation maps, while changed-field deltas compare authoritative IDs and never clear a relation just because a bounded option response omitted it. Preserve three contracted detail sections in edit mode and thread refs/effects so entry focus lands on the first meaningful field, exit focus returns to Edit/Add, and removal targets a surviving adjacent item or Add mitigation control/section anchor. Add the exact immutable empty heading/body and `size-3` (or equivalent 12px semantic utility) to the overdue warning icon. Commit the searchable-filter and detail-editor concerns as separate small conventional commits, each with real multiline bodies; do not mix unrelated formatting.</action>
  <verify>
    <automated>cd apps/web &amp;&amp; pnpm typecheck &amp;&amp; pnpm test</automated>
  </verify>
  <done>Findings 3-5, 7, 9-16 are covered by failing-then-passing regressions; duplicates remain named in test descriptions or the final ledger; all relation filters satisfy the approved combobox contract; edits are lossless and immediately coherent; loading, headings, icon geometry, copy, and focus behavior match 05-UI-SPEC; web typecheck and Vitest pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Prove retry-safe E2E determinism and close every finding</name>
  <files>apps/web/e2e/risk-register-workflow.spec.ts, apps/web/playwright.config.ts, .planning/quick/260901-oiw-remediate-every-confirmed-phase-5-review/260901-oiw-SUMMARY.md, .planning/STATE.md</files>
  <behavior>
    - Finding 1: The equal-bounds assertion derives from authoritative current fixture state or otherwise remains valid after any prior retry mutation; the test does not require reseeding an editable workflow date.
    - Finding 2: Mitigation evidence uses a persisted-state A/B toggle (or an equally deterministic changed value) so every run invokes the mutation and observes `Mitigation control changes saved.`.
    - Playwright retries within one server/database lifetime and two fresh consecutive suite invocations both pass, with collision-resistant isolated database/dist paths and no stale per-PID reuse.
    - The browser proves a non-Doe owner search, off-page selected-label fidelity, relation-preserving unrelated edits, entry/removal focus anchoring, preserved edit headings, immutable empty copy, and exact icon sizing/geometry where those behaviors require real DOM evidence.
  </behavior>
  <action>Make the Risk workflow test independent of its mutation history: read or derive the mutable Risk's current target date before the equal-bounds filter proof, then change it using a deterministic A/B toggle and assert the value that was actually saved; similarly toggle mitigation Evidence between two stable strings so the delta is never empty. Ensure later date/Overdue assertions use the newly persisted value rather than a seed constant. Change Playwright temporary database and Next dist identifiers from recyclable PID-only names to a collision-resistant per-invocation identifier while retaining retry sharing inside one invocation, `reuseExistingServer: false`, and only ports 1338/3100; do not delete broad `.tmp` paths or touch live servers. Extend the existing serial journey only where browser evidence is required for the remediated behaviors, without interception, skip/fixme/only, conditional success, sentinel, mock production response, or timeout weakening. Create the quick-task summary with exactly findings 1 through 18 once each and columns for severity, disposition, implementation or one-line not-applicable justification, regression/evidence, and commit SHA. For 3/9, 7/11, and 8/18 write `duplicate of finding X; fixed by the same implementation` plus independent evidence rather than dropping either ID. Inspect the current tree before any not-applicable disposition; unsupported no-op claims fail the task. Commit E2E/config changes conventionally with a real multiline body. Planning artifacts and the quick-task summary remain uncommitted unless the quick executor contract explicitly requires them; update only the Quick Tasks Completed/continuity portion of STATE.md, without changing Phase 5 status or starting Phase 6.</action>
  <verify>
    <automated>node scripts/verify-phase-05-integrity.mjs &amp;&amp; pnpm --filter @csrm/web build &amp;&amp; cd apps/strapi &amp;&amp; npm test &amp;&amp; cd ../.. &amp;&amp; cd apps/web &amp;&amp; pnpm typecheck &amp;&amp; pnpm test &amp;&amp; pnpm api:check &amp;&amp; pnpm test:e2e &amp;&amp; pnpm test:e2e</automated>
  </verify>
  <done>Findings 1 and 2 are directly retry/rerun safe; the exact Phase 5 integrity/build/Strapi/web gate passes and its two final `pnpm test:e2e` invocations are consecutive and green; all 18 findings have evidence and commit mapping; no live port, frozen artifact, unrelated dirty file, roadmap phase, or completion state was touched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| URL/browser to Server Action/typed service | Untrusted search terms and opaque selected IDs cross into authorised bounded Strapi reads. |
| Strapi list/detail to persisted Assessment aggregate | Parent workflow and release facts decide whether Risk data may be disclosed. |
| Seed bootstrap to mutable analyst data | Development reconciliation must not overwrite analyst-entered workflow relations. |
| Bounded picker response to mutation form | Missing off-page options must not be interpreted as an instruction to clear a persisted relation. |
| Playwright fixture mutation to retry/rerun | Persisted mutations survive retries and must not invalidate later acceptance assertions. |
| Dirty working tree to remediation commits | Existing user-owned changes must not enter task commits. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-260901-OIW-01 | Information Disclosure | Risk Register list/detail | mitigate | Apply one parent eligibility rule before count/page hydration and at detail projection; mounted tests cover partial and closed parents. |
| T-260901-OIW-02 | Tampering | Mutable fixture reseed | mitigate | Creation-only editable relations and stable managed identity; reseed tests preserve analyst changes and arbitrary replacements. |
| T-260901-OIW-03 | Tampering | Relation editors | mitigate | Preserve authoritative selected relations outside bounded options and generate deltas only from intentional changes. |
| T-260901-OIW-04 | Elevation of Privilege | Relation search actions | mitigate | Retain typed authenticated Strapi calls, exact server authorization, bounded queries, and closed response schemas. |
| T-260901-OIW-05 | Spoofing | Filter combobox selection | mitigate | Keep programmatic selection, visible label, opaque ID, active option, and URL chip synchronized across searches/loading. |
| T-260901-OIW-06 | Denial of Service | Server-backed relation search | mitigate | Debounce queries, bound result sizes, ignore stale responses, and provide explicit loading/no-result states. |
| T-260901-OIW-07 | Repudiation | Finding closure and commits | mitigate | Summary ledger maps every numbered finding to test evidence and an inspected conventional commit SHA. |
| T-260901-OIW-SC | Tampering | Package supply chain | accept | No dependency or package-manager installation is permitted for this remediation. |
</threat_model>

<verification>
After all implementation commits, run these checks in order and do not substitute narrower commands:

1. Re-run `node scripts/verify-phase-05-integrity.mjs` from the repository root.
2. Run `pnpm --filter @csrm/web build` from the repository root.
3. Run `npm test` from `apps/strapi`.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm api:check` from `apps/web`.
5. Still from `apps/web`, run `pnpm test:e2e` and then immediately run `pnpm test:e2e` a second time. Both complete suites must pass consecutively; confirm both runs own only 1338/3100, use collision-resistant isolated databases/dist directories, and do not kill or reuse 1337/3000.
6. Byte-compare the two catalogue copies and require their preflight hashes and bytes to be unchanged. Compare the final content-type schema path/hash inventory with preflight and require no added, removed, or changed schema.
7. Run `git diff --check`, inspect `git status --short`, and compare against preflight so unrelated user changes remain preserved and unstaged. Require no dependency, lockfile, generated-contract, sentinel, escape-hatch, ROADMAP, Phase 6, or Phase 5-completion change.
8. Inspect every remediation commit using `git cat-file -p &lt;sha&gt;`; require a conventional atomic subject, a body containing actual newline-separated bullets rather than literal `\n` characters, and no pushed or rewritten history.
9. Mechanically extract the summary ledger and require its sorted identifiers to equal exactly 1 through 18, once each. Require explicit duplicate references for 3/9, 7/11, and 8/18 and concrete current-code/test evidence for any already-correct or not-applicable entry.
</verification>

<success_criteria>
- Every confirmed finding 1-18 is fixed or explicitly disproved against the current tree with one-line evidence; exact duplicate reports remain individually traceable.
- Register list/detail disclosure is consistent and fail closed, while mutable fixture reseeding preserves analyst edits.
- Relation filtering is searchable, bounded, server-backed, URL-honest, accessible, and unaffected by the old `doe` seed or 100-item ceiling.
- Risk and mitigation edits preserve off-page relations, render searched owners immediately, retain contracted section structure/copy/icon rhythm, and manage keyboard focus across entry, exit, and removal.
- The exact integrity, web build, Strapi test, web typecheck/test/api-check gate passes, followed by two consecutive green full E2E runs on isolated 1338/3100 services.
- Content-type schemas and both catalogue copies remain unchanged and byte-identical; no dependency, weakened test, sentinel, escape hatch, unrelated staged file, or live-port interaction is introduced.
- Commits are small, conventional, atomic, and contain real multiline bodies; nothing is pushed, Phase 6 is not started, and Phase 5 remains in progress rather than complete.
</success_criteria>

<source_audit>

| Source | IDs | Requirement | Task | Status |
|---|---|---|---|---|
| GOAL | — | Remediate every confirmed Phase 5 finding, run full gates, prove two-run E2E determinism | 1-3 | COVERED |
| REQ | RISK-01 | Authorised searchable/filterable/sortable/paginated contextual Risk Register | 1-3 | COVERED |
| REQ | RISK-02 | Risk detail and mitigation-control implementation maintenance | 1-3 | COVERED |
| RESEARCH | — | Existing typed Strapi boundary, exact-human authorization, isolated 1338/3100 Playwright harness, no new dependency | 1-3 | COVERED |
| CONTEXT | 1 | Target-date mutation makes retry/rerun fail | 3 | COVERED |
| CONTEXT | 2 | Constant mitigation Evidence makes rerun no-op | 3 | COVERED |
| CONTEXT | 3, 9 | Hard-coded `doe` owner filter search | 2 | COVERED — exact duplicate pair retained individually |
| CONTEXT | 4 | Missing current relations silently clear on unrelated edit | 2 | COVERED |
| CONTEXT | 5 | Searched owner disappears after save | 2 | COVERED |
| CONTEXT | 6, 17 | List/detail parent-state disclosure contradiction | 1 | COVERED — overlapping reports retained individually |
| CONTEXT | 7, 11 | Active off-page filter shows `All` | 2 | COVERED — exact duplicate pair retained individually |
| CONTEXT | 8, 18 | Reseed overwrites analyst relations/arbitrary implementation | 1 | COVERED — exact duplicate pair retained individually |
| CONTEXT | 10 | Relation filters are fixed native selects rather than searchable server-backed comboboxes | 2 | COVERED |
| CONTEXT | 12 | Loading resets current query values | 2 | COVERED |
| CONTEXT | 13 | Overdue icon is unsized | 2 | COVERED |
| CONTEXT | 14 | Immutable empty mitigation heading omitted | 2 | COVERED |
| CONTEXT | 15 | Focus is lost on inline edit/add/remove transitions | 2-3 | COVERED |
| CONTEXT | 16 | Risk edit mode collapses three contracted sections | 2 | COVERED |
| CONTEXT | — | Frozen schemas/catalogue bytes, exact full gate, two consecutive E2E runs, real-newline atomic commits, no push, no live 1337/3000, no Phase 6/completion | Preflight, 1-3, verification | COVERED |
</source_audit>

<output>
Create `.planning/quick/260901-oiw-remediate-every-confirmed-phase-5-review/260901-oiw-SUMMARY.md` when done, then update only the `.planning/STATE.md` Quick Tasks Completed table and quick-task continuity metadata. Do not modify ROADMAP.md, start Phase 6, or mark Phase 5 complete.
</output>
