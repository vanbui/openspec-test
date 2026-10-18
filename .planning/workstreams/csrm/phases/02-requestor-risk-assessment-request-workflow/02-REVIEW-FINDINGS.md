# Phase 2 confirmed review findings (independent, adversarially verified)

## 1. [blocker] apps/strapi/tests/request-workflow.integration.test.ts
**Locus:** lines 52-54 and 253-256 (expectsFocusedPhase2Red / gaps accumulator in test 'PHASE2 RED request workflow guards')
**Claim:** The leftover RED sentinel wrapper makes every workflow-guard assertion inert in normal runs: all ~25 checks accumulate into the 'gaps' array, but the test only fails on gaps when process.execArgv contains the literal test name, which is never true under the actual test script ('node --test dist/tests/... .tmp/tests-dist/tests/*.test.js' in apps/strapi/package.json passes no --test-name-pattern), and the trailing 'if (gaps.length === 0) return;' is a no-op either way, so the test passes regardless of gap count.
**Scenario:** Regress any Phase 2 server guard — e.g. remove the submitted-status lock in prepareRequestorUpdate so a Requestor can PUT a title onto a submitted request (line 147 pushes 'submitted edit denial'), let clients forge requestStatus:'approved' on create (line 81), accept a client-supplied submittedDate (line 166), stop scoping the list so another requestor's rows leak through the hostile filter (line 201), or accept malformed ?filters queries (line 222) — then run 'pnpm --filter strapi test': the suite is green because the only failure path (assert.fail at line 254) is gated behind expectsFocusedPhase2Red, which is false in every CI/local invocation. The commit series (80effa3 RED -> 97a2f9e GREEN) never converted the wrapper into unconditional assertions, so the guards this phase exists to prove are permanently unverified.

## 2. [minor] apps/strapi/tests/authorization.integration.test.ts
**Locus:** lines 86-89, test 'PHASE2 RED development permission seed' ('if (!seededActions && expectsFocusedPhase2Red) assert.fail(...); if (!seededActions) return;')
**Claim:** A leftover RED escape hatch lets this test silently pass (early return) when the development permission seed module cannot be loaded, skipping all of its allowlist, idempotency, and no-IAM/no-delete assertions (lines 90-100), because expectsFocusedPhase2Red is always false under the real 'node --test' invocation.
**Scenario:** If dist/src/bootstrap/seed-development-content-api-permissions.js stops being emitted (file renamed, moved, or dropped from the tsc build), harness.seedDevelopmentPermissions() returns null on MODULE_NOT_FOUND and this test returns early as passing, asserting nothing about seed behavior. The regression is only caught incidentally by contract-catalogue.integration.test.ts line 169 (assert.ok(seeded)), which checks presence but not the allowlist/idempotency/forbidden-action properties this test owns — those checks vanish silently. Severity is reduced from major only because the sibling test catches outright module absence.

## 3. [major] apps/web/src/features/requests/request-table.tsx
**Locus:** columns (lines 105-120) vs sortFor/sortingFor (lines 32-45)
**Claim:** Sortable date columns use ids 'dueDateLabel'/'updatedDateLabel' while the API sort whitelist and URL sort values use 'dueDate'/'updatedAt', so the header sort ids can never map to a valid RequestSort.
**Scenario:** User clicks the 'Due date' or 'Updated' header: toggleSorting emits sorting [{id:'dueDateLabel'}], sortFor finds 'dueDateLabel:asc' not in the allowed list and silently falls back to 'updatedAt:desc' — due-date sorting is unreachable from the UI, 'Updated' can never be toggled to ascending, and because sortingFor(query.sort) yields id 'updatedAt'/'dueDate' (matching no column) the sorted indicator and aria-sort are never shown for these columns even when the URL carries sort=dueDate:asc.

## 4. [major] apps/web/src/features/requests/request-actions.ts
**Locus:** revalidateRequestPages (lines 34-37) / submitRequestAction (lines 62-72)
**Claim:** Submit never revalidates or refreshes the request detail route, leaving the server-rendered detail page (and its router-cache entry) showing the pre-submission draft state.
**Scenario:** On /app/requests/{id}, the user submits via RequestWorkflowActions: only the client-local actions section flips to 'Submitted' while the PageHeader StatusBadge rendered by the server still reads 'Draft' on the same screen; navigating away and back within the client router cache window serves the stale draft page complete with 'Edit request' and 'Submit request' buttons, and a second submit then fails confusingly ('This request changed while you were editing it' / 403). revalidatePath('/app/requests') only revalidates that exact page, not /app/requests/[documentId].

## 5. [major] apps/web/src/features/dashboard/requestor-dashboard-service.ts
**Locus:** getRequestorDashboard (lines 69-86) / deriveRequestorDashboard (lines 49-67)
**Claim:** Dashboard counts are derived from a single page of at most 50 requests sorted by updatedAt desc, so the displayed 'Draft requests' and 'Questionnaires in progress' counts undercount and drop items once a requestor has more than 50 requests.
**Scenario:** A requestor with 120 authorized requests where 8 drafts sit outside the 50 most recently updated: the widget shows a count excluding those drafts and omits them from the action list entirely, presenting an authoritative-looking but wrong number with no truncation signal; a status-filtered count query (or pagination.total per status) is needed for correct derivation.

## 6. [minor] apps/web/src/features/requests/request-table.tsx
**Locus:** resolvedState (line 140) with RequestEmptyState (lines 65-83)
**Claim:** An empty result page with a nonzero total (page beyond pageCount) is rendered as the zero-data empty state, contradicting the pagination footer.
**Scenario:** User opens a stale bookmark /app/requests?page=5 after their data shrank to 2 pages: Strapi returns data:[] with total=12, resolvedState becomes 'empty', and the unfiltered branch shows 'Create your first assessment request' while the same screen shows '12 results' and 'Page 5 of 2' with both pager buttons in inconsistent states; the page is never clamped or reset.

## 7. [minor] apps/web/src/features/requests/request-form.tsx
**Locus:** submitDraft (lines 157-168) inside ConfirmDialog
**Claim:** When client-side validation fails during confirm-dialog submission, submitDraft throws without setting formError or toasting, so the dialog stays open with zero feedback while the field errors it set are hidden behind the modal overlay.
**Scenario:** On the edit page the user blanks the title, clicks 'Submit request', confirms: form.trigger() fails, the thrown error is swallowed by ConfirmDialog's catch, the dialog simply stops spinning with no message (errorMessage stays null), and the title error message is only visible after the user manually cancels the dialog — repeated confirms appear to do nothing.

## 8. [minor] apps/web/src/features/requests/request-actions.ts
**Locus:** serviceFailure (lines 21-32)
**Claim:** A 404 from update/submit (request deleted or not visible) is normalized to 'The request service is unavailable. Please try again later.', misreporting a permanent record-level condition as a transient outage.
**Scenario:** User A holds the edit form open while the draft is deleted in another session; saving returns 404 and the form tells the user to 'try again later', inviting indefinite retries against a nonexistent record instead of signalling the request no longer exists.

## 9. [major] apps/web/src/features/requests/request-table.tsx
**Locus:** columns (lines 105-120) vs sortFor (lines 37-45)
**Claim:** Sortable columns 'Due date' and 'Updated' use accessor ids 'dueDateLabel'/'updatedDateLabel' while the sort allowlist and RequestSort values use 'dueDate'/'updatedAt', so those column sorts can never activate and the active sort indicator/aria-sort never reflects reality.
**Scenario:** User clicks the 'Due date' header: DataTable emits sorting [{id:'dueDateLabel'}], sortFor builds 'dueDateLabel:desc' which is not in the allowlist and silently falls back to 'updatedAt:desc' — nothing changes. Conversely, with the default sort 'updatedAt:desc', sortingFor returns id 'updatedAt' which matches no column id, so no header shows a sort chevron and every th reports aria-sort='none' even though the data is sorted — violating the design rule 'direction always visible' and misinforming screen-reader users.

## 10. [major] apps/web/src/components/csrm/data-table.tsx
**Locus:** lines 242, 257, 295 (text-[length:var(--text-table-size)], text-[length:var(--text-micro-size)], tracking-[var(--tracking-micro)])
**Claim:** The DataTable references CSS custom properties --text-table-size, --text-micro-size, and --tracking-micro that are defined nowhere (not in apps/web/app/globals.css nor in the compiled CSS), so the font-size/letter-spacing declarations are invalid at computed-value time and silently fall back to inherited values.
**Scenario:** Rendered table headers get 'uppercase' but inherit 14px with no +0.05em tracking instead of the design direction's 11px/500 tracked micro-label, and table body cells render at inherited 14px instead of the mandated 13px --text-table size — the design's core density spec (§3.10) never applies, and the broken var() references violate rule 15 (every value referenced through a real semantic token).

## 11. [minor] apps/web/app/(app)/app/requests/new/page.tsx
**Locus:** route segment (no loading.tsx in new/ or [documentId]/edit/)
**Claim:** The /app/requests/new and /app/requests/[documentId]/edit routes have no route-level loading UI, so they inherit the parent segments' loading.tsx which renders a completely different screen (the 'My Requests' page header plus table skeleton, or the detail-page skeleton).
**Scenario:** User clicks 'New request': while listInformationSystems/listInformationAssets resolve, the page shows an h1 'My Requests' with a search form and table skeleton, then swaps wholesale to the 'New assessment request' single-column form — a misleading heading during load and a skeleton that does not mirror the final layout, violating the design direction's skeleton hard rule (do-not #7, 'zero layout shift on swap') and the five-deliberate-states requirement for the create/edit routes.

## 12. [minor] apps/web/src/components/csrm/data-table.tsx
**Locus:** TableLoading (lines 91-107)
**Claim:** The loading state renders five generic full-width skeleton bars with no header row and no column structure, and ignores the current pageSize, instead of mirroring the final table layout as the design direction requires ('skeleton mirrors the final layout exactly — same row height/density, same column widths, realistic row count').
**Scenario:** A list of 10+ rows loads: user sees 5 undifferentiated bars inside a padded card (no sticky header, different container padding), then the layout shifts to a 40px header plus 10 44px rows — visible layout jump on swap, violating do-not #7.

## 13. [minor] apps/web/src/components/csrm/data-table.tsx
**Locus:** line 95 (TableLoading aria-label) and line 221 (<output> results count)
**Claim:** The generic reusable DataTable composite hardcodes the domain copy 'Loading assessment requests' in its loading announcement, and its <output> element (an implicit aria-live region) reports '0 results' and 'Page 1 of 1' while state is 'loading'.
**Scenario:** Any future reuse of DataTable (e.g. information systems or assets catalogue) announces 'Loading assessment requests' to screen readers; and on the current requests list, a screen-reader user navigating during load hears the live region report '0 results' before data arrives, indistinguishable from a genuine empty result set.

## 14. [minor] apps/web/src/components/csrm/confirm-dialog.tsx
**Locus:** confirm Button (lines 67-76)
**Claim:** The generic ConfirmDialog composite hardcodes its confirm-button label as 'Submit request' / 'Submitting request…' with no prop, even though title/description/trigger are configurable, so any non-submission confirmation (including the design direction's destructive confirms, which must use an explicit action noun and the danger-solid button) renders the wrong action label and wrong button variant.
**Scenario:** Phase 3 reuses ConfirmDialog for e.g. deleting or closing a request: the dialog's confirm button still reads 'Submit request', directly contradicting its own title/description and the design rule that destructive confirms carry an explicit noun ('Delete 3 assessments') on a danger-solid button.

## 15. [minor] apps/web/src/features/requests/request-form.tsx
**Locus:** RelationField (lines 104-138) and thirdPartyInvolvement field (lines 192-201)
**Claim:** The checkbox-group RelationField and the third-party checkbox bypass FormControl, so aria-invalid and aria-describedby (linking FormDescription/FormMessage) are never wired to the controls, and every checkbox in the mapped RelationField list is assigned the same field.ref.
**Scenario:** The server returns fieldErrors for 'informationSystems' (e.g. an unauthorised documentId stripped server-side): the FormMessage text renders visually below the fieldset, but the group carries no aria-invalid or aria-describedby association, so a screen-reader user focused in the checkbox list is never told the group is in error; form.setFocus/error focus targeting also lands on the last-rendered checkbox because the shared ref is overwritten each render.

## 16. [minor] apps/web/src/features/requests/request-form.tsx
**Locus:** TextField/ChoiceField via FormMessage (used throughout lines 52-102, 182-212)
**Claim:** Field validation errors render as text-only FormMessage with no leading icon, while the design direction's form recipe mandates 'danger-fg 12px text + 14px icon directly below the field' and states 'Red is never the only signal (icon + text always)'.
**Scenario:** User blurs an empty required title: only a small red 'Enter a request title.' line appears — no icon accompanies it, so the new request form ships a validation presentation that violates the authoritative design direction's forms section (the shadcn FormMessage was adopted unmodified rather than extended to the specified error anatomy).

## 17. [major] apps/strapi/src/middlewares/csrm-development-identity.ts
**Locus:** lines 28-31, NODE_ENV gate in csrmDevelopmentIdentity
**Claim:** The development-only gate `process.env.NODE_ENV === "development"` is satisfied by Strapi's own default — @strapi/core/dist/configuration/index.js executes `process.env.NODE_ENV = process.env.NODE_ENV || 'development'` — so the header-impersonation bridge can activate on a deployed instance where NODE_ENV was simply never set.
**Scenario:** An operator deploys Strapi (e.g. `strapi start` in a container) without exporting NODE_ENV but with a copied .env containing CSRM_DEV_IDENTITY=true; Strapi defaults NODE_ENV to 'development', the middleware activates, seed-development-content-api-permissions grants the public role the six content-API actions, and any unauthenticated internet caller sends `x-csrm-dev-identity: jane.doe@idambox.com` (fixture emails are committed in apps/web/src/lib/auth/development-session-adapter.ts) to fully impersonate any active IdamBox user and read/create/update assessment requests. The NODE_ENV check provides no protection as a second factor because its failure mode (unset) resolves to 'development'; the gate should require an explicit development marker (or refuse when NODE_ENV was defaulted) rather than trusting Strapi's fallback.

## 18. [minor] apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
**Locus:** seedDevelopmentContentApiPermissions (lines 27-64)
**Claim:** The dev permission seed is add-only and never reconciles or removes the public-role grants when the dev bridge is disabled, so a database that was ever booted with CSRM_DEV_IDENTITY=true permanently keeps public users-permissions grants for find/findOne/create/update on csrm-assessment-request and find on the two reference types.
**Scenario:** A team runs the app in development with the bridge enabled, then promotes the same database (or flips CSRM_DEV_IDENTITY=false / NODE_ENV=production); the early-return at lines 30-35 skips seeding but the previously created plugin::users-permissions.permission rows remain, leaving those six content-API routes open at the users-permissions layer with only the csrm-authorization policy (which depends on the dev middleware to populate ctx.state.idamboxUser) standing between anonymous traffic and the workflow controllers — one policy regression or route added without the policy becomes an unauthenticated data exposure. The seed should delete (or at minimum log loudly about) its grants when the gate condition is false.

## 19. [minor] apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts
**Locus:** findOne/create/update/delete route configs (lines 15-18), same pattern in apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts
**Claim:** Only the reference-data `find` route received the global::csrm-authorization FunctionAPI policy; findOne, create, update, and delete on csrm-information-system and csrm-information-asset carry only global::csrm-app-enabled, so their protection rests entirely on no users-permissions grant existing rather than on the authoritative server-side authorization layer.
**Scenario:** An administrator (or a future seed/migration) enables the Public or Authenticated role's csrm-information-system permissions in the users-permissions admin UI — a routine-looking Strapi action — and reference data becomes mutable (POST/PUT/DELETE /api/csrm-information-systems) by callers with no FunctionAPI grant at all, since csrm-app-enabled only checks the csrmAppIsEnabled flag; the catalogue defines reference data as read-only (reference_data_api has only the two GET FunctionAPIs), so these mutation routes should be explicitly denied or policy-gated to fail closed, consistent with the assessment-request router where every operation carries csrm-authorization.

