# Phase 5 review findings (independent multi-lens review; adversarially confirmed)

Fix every item; if one is genuinely not a defect in the current tree, record it as not-applicable with a one-line justification. Never a silent skip.

## 1. [major] () apps/web/e2e/risk-register-workflow.spec.ts
**Locus:** line 312 (riskForm targetDate fill '2026-08-30') vs lines 182-186 (targetDateFrom/To=2026-12-01 expecting '1 results')
**Claim:** The journey permanently rewrites the mutable fixture's targetDate from the seeded 2026-12-01 to 2026-08-30 and never restores it, while the seed's repair mode (seed-risk-register-workflow.ts updateData = relations only) intentionally preserves workflow fields, so the equal-bounds date-filter assertion at line 185 can never pass on a second execution against the same database.
**Scenario:** On CI a transient failure after line 312 (e.g. an axe or geometry flake) triggers a retry (playwright.config.ts retries: 2); the webServer and its SQLite DB persist across retries, the retried test navigates to ?targetDateFrom=2026-12-01&targetDateTo=2026-12-01 and gets '0 results' instead of '1 results', so every retry fails deterministically and the run cannot recover. Locally, stale .tmp/playwright-e2e-<pid>.db files are never deleted, so a recycled Windows pid replays the same guaranteed failure on a fresh run.

## 2. [minor] () apps/web/e2e/risk-register-workflow.spec.ts
**Locus:** lines 327-330 (constant persistedEvidence 'Phase 5 browser verification evidence.' then expecting 'Mitigation control changes saved.')
**Claim:** The mitigation-evidence persistence proof fills a constant string with no rerun toggle, and the editor (mitigation-control-list.tsx delta()/submit(): empty edit delta calls onCancel() with no feedback) silently closes when the value is unchanged, so on any rerun against a reused database the 'Mitigation control changes saved.' assertion at line 330 fails deterministically.
**Scenario:** A CI retry (or a local run on a recycled per-pid .tmp database) reaches the mitigation edit with evidence already equal to 'Phase 5 browser verification evidence.'; Save computes an empty delta, the form cancels without invoking updateMitigationControlAction or rendering any status text, and line 330 times out — unlike the risk-comments field, which was deliberately made rerun-safe with the A/B toggle at lines 314-318.

## 3. [major] () apps/web/app/(app)/app/risks/page.tsx
**Locus:** RiskRegisterContent, line 25: searchRiskRegisterOwners('doe')
**Claim:** The Risk owner / Treatment owner filter dropdowns are populated from a hard-coded search for 'doe', so only users whose name matches 'doe' are ever offered as owner filter options.
**Scenario:** An analyst wants to filter the register by risk owner 'Alice Analyst' (who owns seeded risks via the assessment workflow); the Risk owner select in 'More filters' lists only Bob Doe (the dev-fixture match), so the analyst cannot select Alice at all — the owner filters only work through hand-edited URLs. The searchable-owner wiring (`mergeSelectedRiskPickerOption`, `/v1/users` search service) exists and is unit-tested but is never used by the page or filters.

## 4. [major] () apps/web/src/features/risks/mitigation-control-list.tsx
**Locus:** MitigationControlEditor controlOwner SelectField (line 179) with options.users built at apps/web/app/(app)/app/risks/[documentId]/page.tsx lines 37-38
**Claim:** Editing a mitigation control whose controlOwner is not the risk's own riskOwner/treatmentOwner silently submits controlOwner: null and clears the owner on the server.
**Scenario:** A control implementation's owner was set to user Carol in the Phase 4 assessment editor. On the register detail page options.users contains only the risk's riskOwner and treatmentOwner, so the native select has no option matching Carol's documentId and its DOM value falls back to ''. The analyst edits only the Evidence field and saves; delta() compares the select's '' (normalized to null) against initial 'carol-id', includes controlOwner: null in the PATCH (controlImplementationUpdateInputSchema accepts null), and the server erases Carol as owner — unrequested data loss. The same missing-option clearing applies to informationSystemImpacted/informationAssetImpacted in RiskDetailEditor when the inventory exceeds the 100-item list cap.

## 5. [major] () apps/web/src/features/risks/risk-detail-editor.tsx
**Locus:** mergeDetail lines 126-127 resolving owners via relation(options.users, ...) instead of selectedOwners
**Claim:** After saving a risk owner or treatment owner chosen through the OwnerCombobox search, the detail view renders the owner as 'Not provided' even though the save succeeded, because mergeDetail resolves the saved id against the static options.users list (at most the two pre-existing owners) and ignores the selectedOwners map that holds the searched user.
**Scenario:** On /app/risks/[documentId] the analyst searches for 'Dana', selects her as Treatment owner, and saves. updateRisk succeeds (the PATCH response projectRiskSummary carries no owner data), mergeDetail's relation(options.users, 'dana-id') returns null, and the Ownership section shows Treatment owner 'Not provided' until a full reload — the exact stale-owner-label bug fixed in Phase 4 as WR-01 reintroduced in the Phase 5 editor. If the analyst re-opens the editor before reloading, the combobox also shows no owner selected.

## 6. [minor] () apps/strapi/src/api/csrm-risk/services/risk-register.ts
**Locus:** parentLock() lines 107-114 vs listRiskRegister/applyFilters (no assessment-status constraint)
**Claim:** Risks under an assessment with assessmentStatus 'closed' (a valid value in the frozen schema enum) appear in the GET /v1/risks list but their detail endpoint returns 404 because parentLock() only recognises released or draft/in-review parents.
**Scenario:** An assessment is set to 'closed' (the frozen content-type allows it, e.g. via Strapi admin or a future closure flow). Its risks are returned by the register list — applyFilters never constrains parent status — so the register table renders rows for them, but clicking any such row calls getRiskRegisterDetail, parentLock() falls through to detailUnavailable(), and the user lands on 'Risk not available' for a risk the same screen just listed. The same 404 hits partially-approved data (assessmentStatus 'approved' with missing approvalDate).

## 7. [minor] () apps/web/src/features/risks/risk-register-filters.tsx
**Locus:** OptionSelect lines 34-50 (selectedLabels never merged into options)
**Claim:** When an active riskOwner/treatmentOwner/assessment/system/asset filter's documentId is not among the fetched picker options, the select control displays 'All' while the filter is actually applied, because the page's selectedLabels are never merged into the option list.
**Scenario:** A colleague shares a register URL with ?riskOwner=<alice-id>. Alice does not match the 'doe' owner search (or an inventory item is beyond the 100-item cap), so the select receives value='<alice-id>' with no matching option and renders the 'All' option, while the results are filtered and the chip shows Alice — the popover contradicts the applied filter state. mergeSelectedRiskPickerOption was written and tested for exactly this and is unused.

## 8. [minor] () apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
**Locus:** reconcileByStableKey updateData at lines 183-225 (riskRelations) and implementation update at lines 232-240
**Claim:** Every reseed of the mutable fixture risk re-forces its riskOwner, treatmentOwner, riskType, impacted system/asset back to the fixture values, and rewrites the first found control implementation's control and controlOwner, reverting analyst edits despite the stated 'workflow facts only at creation' contract.
**Scenario:** With IDAMBOX_SEED_CSRM=true, an analyst uses the register detail editor to change RSK-DEV-MUTABLE-001's treatment owner to another user and reassigns a mitigation control's owner; on the next Strapi restart the seed's updateData: riskRelations and implementationRelations update silently reset both to Bob Doe, regressing workflow state exactly like the reseed bug fixed in commit 2dca276 — and if the analyst deleted the fixture implementation and added their own, the seed rewrites that implementation's control link (findMany limit 1 matches any implementation on the risk).

## 9. [major] () apps/web/app/(app)/app/risks/page.tsx
**Locus:** line 25 — searchRiskRegisterOwners('doe')
**Claim:** The Risk owner / Treatment owner filter option lists are seeded with a hardcoded search term 'doe', so the register can only ever offer owners whose display name matches "doe".
**Scenario:** An analyst opens /app/risks wanting to filter by treatment owner "Priya Sharma"; the Risk owner and Treatment owner selects contain only users matching the literal string 'doe' (a fixture-name coincidence, capped at 20 results by the owners picker schema), so the owner filters are unusable for any real user population and the filter silently appears to have no matching owners.

## 10. [major] () apps/web/src/features/risks/risk-register-filters.tsx
**Locus:** lines 34-59 — OptionSelect / MoreFilterFields
**Claim:** Owner, assessment, system, and asset filters are plain native <select> elements with fixed pre-fetched options, not the bounded searchable server-backed comboboxes the approved UI spec requires (05-UI-SPEC 'URL-driven query state' and Accessibility contract: comboboxes must expose expanded state, active option, and loading/no-result feedback).
**Scenario:** An organisation with more than 100 information systems (listRiskRegisterSystems requests page 1 pageSize 100, and the payload schema caps systems/assets at 100) cannot select any system past the first 100 alphabetically, and no filter offers type-ahead search; the spec's combobox interaction contract (searchable, server-backed, no-result feedback) is unmet for all four relation filters.

## 11. [minor] () apps/web/app/(app)/app/risks/page.tsx
**Locus:** line 31 — pickerOptions passed without merging meta.selectedLabels; mergeSelectedRiskPickerOption in risk-schema.ts:286 is never called from product code
**Claim:** A relation filter value present in the URL but absent from the fetched option list is not merged into the select options, so the labelled select in More filters displays "All" while that filter is actively constraining results.
**Scenario:** An analyst opens a shared URL /app/risks?riskOwner=<id> where that owner does not match the hardcoded 'doe' owner seed (or a system beyond the first 100): the chip row correctly shows "Risk owner: Jane Smith" from selectedLabels, but the Risk owner select inside More filters shows "All", presenting contradictory filter state; the helper written and unit-tested for exactly this (mergeSelectedRiskPickerOption) is dead code.

## 12. [minor] () apps/web/app/(app)/app/risks/page.tsx
**Locus:** line 35 (Suspense fallback) and app/(app)/app/risks/loading.tsx — query={parseRiskRegisterQuery({})}
**Claim:** The register loading state renders the filter toolbar with default (empty) query values instead of the current URL's filter state, violating the spec rule that loading 'disables controls but leaves current values visible' (including the target-date addendum's 'Loading keeps both values visible').
**Scenario:** An analyst opens a shared link /app/risks?treatmentStatus=Overdue&targetDateFrom=2026-01-01: during the loading state every filter control shows blank/'All', both date inputs are empty, no active chips render, and the mobile trigger reads "Filters (0)" — then the real values pop in after data resolves, so the loading UI misrepresents active filter state.

## 13. [minor] () apps/web/src/features/risks/risk-register.tsx
**Locus:** line 65 — TargetDate overdue indicator <AlertTriangle aria-hidden="true" /> with no size class
**Claim:** The Overdue warning triangle is an unsized lucide icon, so it renders at the lucide default 24x24px inside 13px-text table cells and mobile card dd values, unlike every other icon in the phase (Badge children are constrained to size-3; field-error icons use explicit size-4).
**Scenario:** A risk with targetDate in the past renders a 24px triangle beside 13px 'Overdue' text in the Target date column; in compact 36px rows the icon dominates the row height and breaks vertical rhythm, and in the mobile card the icon dwarfs the adjacent date, contradicting the design direction's 4px-grid icon discipline.

## 14. [minor] () apps/web/src/features/risks/mitigation-control-list.tsx
**Locus:** line 85 — released empty branch returns only a <p>
**Claim:** The immutable empty Mitigation controls section omits the required 'No mitigation controls added' heading — the spec says the released empty state keeps the same heading and changes only the body copy.
**Scenario:** An analyst opens a released Risk that has no control implementations: the Mitigation controls DetailSection shows only the sentence 'No mitigation controls were recorded before this assessment was released.' with no 'No mitigation controls added' subheading, so the released and mutable empty presentations diverge structurally from the contracted copy pattern (05-UI-SPEC 'Empty immutable section: same heading; body …').

## 15. [minor] () apps/web/src/features/risks/risk-details.tsx
**Locus:** line 97 (Edit risk trigger) and mitigation-control-list.tsx line 126 (Add mitigation control)
**Claim:** Activating 'Edit risk' or 'Add mitigation control' unmounts the focused trigger button without moving focus into the inline form, dropping keyboard focus to <body>; the same happens after a successful 'Remove mitigation control' when the dialog tries to restore focus to a trigger that no longer exists.
**Scenario:** A keyboard-only analyst presses Enter on 'Edit risk': the button is replaced by the editor, focus resets to the document body, and the next Tab restarts from the skip link/shell navigation instead of the first form field — focus is managed on exit (focusEdit on save/cancel) but not on entry, and removal of a mitigation control leaves focus unanchored after the confirm dialog closes.

## 16. [minor] () apps/web/src/features/risks/risk-details.tsx
**Locus:** lines 87-99 — editing branch renders one DetailSection titled 'Risk statement and classification'
**Claim:** Entering edit mode collapses the Ratings and Ownership-and-treatment sections into a single section headed 'Risk statement and classification', so rating and treatment fields (Treatment owner, Treatment status, Target date, etc.) render under a heading that does not describe them and the h2 outline loses two contracted sections.
**Scenario:** An analyst clicks Edit risk and, navigating by headings with a screen reader, finds Inherent rating, Treatment plan, and Treatment owner fields all announced under the 'Risk statement and classification' section; the spec instead requires the statement/classification, ratings, and ownership/treatment sections each to change into the validated form, preserving the three-section structure.

## 17. [minor] () apps/strapi/src/api/csrm-risk/services/risk-register.ts
**Locus:** applyFilters/listRiskRegister (lines 220-303) vs parentLock (line 107)
**Claim:** The register list route discloses full row projections (riskNumber, riskStatement, ratings, treatment owner, assessment number/title) for risks whose parent assessment is in a partial-release or closed state that the detail route deliberately treats as never-disclosable and 404s, so the two register routes enforce contradictory disclosure rules over the same records.
**Scenario:** An assessment reaches assessmentStatus 'approved' with a null approvalDate (or 'closed', as the seed repair test itself leaves ASM-DEV-RISK-001), and its risk RSK-X exists. GET /api/v1/risks returns RSK-X with its statement, ratings, owner, and assessment title, but GET /api/v1/risks/{RSK-X} returns 404 'CSRM Risk is not available.' — the analyst sees register rows that leak exactly the fields the detail gate refuses to serve and that can never be opened (the /app/risks list renders dead links to a 'not available' page). The shipped integration tests encode both halves of the contradiction: the date-range list test returns rows under releaseFacts.approvedOnly while the detail test asserts the same parent class 'must never be disclosed'.

## 18. [minor] () apps/strapi/src/bootstrap/seed-risk-register-workflow.ts
**Locus:** reconcileRiskRegisterWorkflow implementation reconcile (lines 232-251) and risk updateData (line 224)
**Claim:** Reseed silently overwrites analyst-entered relation choices on the mutable fixture, contradicting the file's own 'never normalises analyst-entered fields' rule: it force-repoints riskOwner/treatmentOwner/system/asset back to Bob after an analyst reassigns them through the register editor, and it selects an arbitrary first control implementation linked to the risk (findMany limit 1, no sort) and rewrites its control and controlOwner to fixture values even when that implementation was created by the analyst with a deliberately different control.
**Scenario:** In a dev environment with the seed enabled, an analyst uses the /app/risks/RSK-DEV-MUTABLE-001 editor to reassign treatmentOwner from Bob to Jane and deletes the seeded 'E8-PATCH_APPLICATIONS-003' mitigation, creating a new implementation against a different control they chose. On the next server restart the seed's updateData/implementation reconcile reverts treatmentOwner to Bob and repoints the analyst's own implementation to control E8-PATCH_APPLICATIONS-003 with Bob as controlOwner — the reseed workflow-state regression the triple-gated fixture was specified to avoid (the seed test only exercises the null-relation repair path, so this regression is untested).

