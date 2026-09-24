# Phase 4 review findings (independent multi-lens review; 19 adversarially confirmed)

Every item below was raised by a review lens; the workflow adversarially verified each and confirmed 19 as real. Codex must read the current code and fix each; if any item is genuinely not a defect in the current tree, record it as such with justification rather than a no-op.

## 1. [minor] (git history, range 3c72807^..67ee441)
**Locus:** commit messages, e.g. 3c046cb, 7bb08e2, a2b4bf5, ebc4bb6, 6fb6acc, 3e6e99a, e6971eb (14 commits total)
**Claim:** Fourteen commit bodies contain literal backslash-n escape sequences instead of real newlines, producing malformed one-line bullet lists in git history.
**Scenario:** Running `git log` on the range shows bodies like '- Record closed actor-specific assessment detail transport\n- Capture persisted Risk reload and readiness verification' rendered as a single line with visible \n text, so changelog tooling and reviewers reading history get corrupted bullet formatting; the commits are already on the shared branch and cannot be cleanly amended without a rewrite.

## 2. [major] scripts/verify-phase-04-integrity.test.ps1
**Locus:** lines 34-41, $forbiddenFixtures loop
**Claim:** The hostile-fixture regression loop is vacuous: its body checks the constant condition `if ($guard -notmatch 'Specification changes exceed')` six times without ever referencing $fixture, constructing a mutated specification, or running the guard against one, so it can never fail for any of the six named hostile cases and merely duplicates the string-presence check already made at line 9.
**Scenario:** Rewrite verify-phase-04-integrity.ps1 so its structural comparison silently ignores a changed path, operationId, parameter, request body, non-200 response, or unrelated schema (e.g. compare only path names instead of full JSON) while keeping the literal error message 'Specification changes exceed...' in the file: every 'hostile fixture' iteration still passes and the regression test green-lights a guard that no longer rejects any of those six contract mutations.

## 3. [minor] apps/strapi/tests/assessment-workflow.integration.test.ts
**Locus:** lines 1323-1337 ('Requestor release capability remains read-only at every aggregate route'); same pattern at 761-778 and 960-979 actor-denial loops
**Claim:** The requestor/denied-actor mutation-denial assertions check only the 403 status code and never re-read the targeted documents, and because this is the final test in the file no later test indirectly detects a mutation that was applied despite the denial response.
**Scenario:** A regression that makes the authorization policy return 403 after the controller has already executed the write (or a controller that performs the mutation before the actor check on these routes) would delete the released ControlImplementation (DELETE /v1/control_implementations/{id}), overwrite the released Risk statement, or add a Risk to the released aggregate while the test still passes, since e.g. the earlier persistence check of 'Mounted aggregate risk' at line 744 runs before these denials and nothing reads the records afterward; likewise a denied-actor DELETE of contextualControlImplementationId (line 969) that actually executed would go unnoticed because the later release-readiness flow sets treatmentAction 'Accept' and never needs that implementation.

## 4. [minor] apps/strapi/tests/assessment-workflow.integration.test.ts
**Locus:** line 68, assertion PERSISTED_OWNER_LEAKED_THROUGH_SEARCH
**Claim:** The assertion that the persisted owner does not leak through the capped user search is tautological: the fixture displayName 'Zulu Owner' contains no letter 'a', so it can never match the `search=a` query regardless of whether the 20-row cap or any leak protection exists.
**Scenario:** Remove the pageSize cap and the active-only filter from the /v1/users search handler entirely: 'Zulu Owner' still fails the substring match for 'a', the assertion still passes, and the test's claimed proof that a persisted owner outside the result cap is not disclosed is never actually exercised (the cap itself is only covered by the separate length===20 assertion).

## 5. [major] apps/web/src/components/csrm/risk-rating-badge.tsx
**Locus:** riskRatingPresentations (lines 18-39)
**Claim:** The severity badge ignores the defined --color-risk-* severity ladder tokens (unused anywhere in src) and instead maps Moderate to info-blue, High to the amber reserved for Moderate, and Critical to a tinted alpha-modified destructive instead of the solid critical tier, breaking the design direction's severity ladder and the 'blue = interactive only' rule.
**Scenario:** An analyst scanning the released dashboard widget or risk list sees a Moderate risk rendered in the same blue family as links/primary buttons (reads as neutral info, not a mid-ladder severity) and a High risk in the exact amber (#B54708) the design assigns to Moderate, so relative severity is misjudged at a glance; the icon set also uses two circle glyphs (CircleCheck/CircleGauge) for Low vs Moderate instead of the mandated circle/diamond distinct-shape system, weakening the non-color signifier for low-vision users.

## 6. [major] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** input onKeyDown (lines 97-117)
**Claim:** Enter is only intercepted when an option has been arrowed to, so pressing Enter in the owner search input at any other moment triggers implicit submission of the enclosing Risk form.
**Scenario:** In the analyst editor an analyst types a name into 'Risk owner' and presses Enter expecting the first suggestion (or while the 300ms debounce/search is still in flight); the keystroke instead submits the entire RiskEditor form, firing updateRiskAction with whatever half-edited values are present and collapsing the search — an accidental save from a routine combobox keystroke.

## 7. [major] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** CommandItem list (lines 124-142) with src/components/ui/command.tsx line 150
**Claim:** Keyboard navigation updates only aria-activedescendant/aria-selected while the visible highlight is driven by cmdk's internal data-selected state (which auto-selects the first item and never follows the custom ArrowUp/ArrowDown handling), so the visually highlighted option and the keyboard-active option diverge.
**Scenario:** A sighted keyboard user opens owner results and presses ArrowDown twice: the first row stays visually highlighted (cmdk data-selected styling) with no visible indication on the actual active third row, then Enter selects the un-highlighted option the screen-reader-only state points at — the visible focus indicator contradicts the operation (WCAG 2.4.7 / operable-without-vision-only failure).

## 8. [major] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** SelectField/dateFields/exemptionReviewDate/OwnerCombobox render paths (lines 189-199); also assessment-editor.tsx lines 276-280
**Claim:** Server-side field validation errors are rendered only for the 15 text fields — setError results for every date field, select field, exemptionReviewDate, riskOwner and treatmentOwner (and all AssessmentMetadata fields except summary, including the 04-22 nextReviewDate validation) have no message output, aria-invalid, or aria-describedby wiring.
**Scenario:** The 04-22 validation rejects an analyst's malformed exemptionReviewDate or nextReviewDate; the action returns fieldErrors for that field, the editor calls setError on it, but no error text ever appears next to any date/select control — the analyst sees only the generic banner 'Check the assessment details and try again' and cannot tell which of ~20 fields is wrong, and screen readers get no association even for the errors that do render (red text only, no icon, no aria-describedby).

## 9. [major] apps/web/src/features/assessments/control-implementation-editor.tsx
**Locus:** submit() error branch (lines 89-92) and remove() (lines 97-106, 124)
**Claim:** The mitigation-control editor drops result.fieldErrors entirely, and a failed removal sets its error on the form behind the still-open modal (ConfirmDialog's errorMessage prop is not wired), leaving the dialog open with no visible or announced failure feedback.
**Scenario:** An analyst confirms 'Remove mitigation control' while the assessment was concurrently released; deleteControlImplementationAction returns 409, remove() throws to keep the dialog open, but the error Alert renders in the form underneath the modal scrim — the analyst stares at an open dialog where the confirm button just reset with no explanation, and field-level validation failures on save (e.g. reviewDate) surface only as the generic form banner.

## 10. [minor] apps/web/src/features/assessments/assessment-draft-job.tsx
**Locus:** JobState (lines 47-57) with src/components/ui/alert.tsx role="alert"
**Claim:** Every polled job-status transition mounts a new shadcn Alert whose hardcoded role="alert" makes queued→running→completed announcements assertive, duplicating the intentional polite sr-only announcer and contradicting the polite-announcement requirement for polling UI.
**Scenario:** A screen-reader user starts draft assistance; within seconds the queued, running, and completed alerts each mount as assertive live regions, interrupting whatever the user is reading up to three times in ~30 seconds while the same text is also announced by the polite role="status" region — double, assertive spam for routine progress updates.

## 11. [minor] apps/web/src/features/assessments/assessment-draft-job.tsx
**Locus:** timed-out branch (line 203)
**Claim:** After the 30-second polling bound is reached the UI offers no in-page control to resume status checks — the alert only instructs the user to 'Return to this request', so recovery requires a full page reload/navigation.
**Scenario:** A slow draft job exceeds 30s; polling stops (correctly bounded) but the analyst is left with a terminal alert and no 'Check again' action, violating the error-state rule that every failure state carries a recovery affordance; the job may have completed seconds later with no way to discover it without reloading.

## 12. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** AssessmentEditorSkeleton (line 105) vs populated layout (line 172)
**Claim:** The editor skeleton uses lg:grid-cols-[minmax(0,1fr)_20rem] while the real editor uses xl:grid-cols-[minmax(0,1fr)_22rem], so the skeleton does not mirror the final layout at 1024-1280px viewports and the sidebar column width differs by 2rem, causing layout shift on swap.
**Scenario:** On a 1100px-wide window the loading skeleton renders a two-column layout, then the loaded editor snaps to single-column (xl breakpoint not met) — content jumps on hydration, breaking the 'skeleton mirrors the final layout exactly, zero layout shift' rule.

## 13. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** release readiness card (lines 177-180)
**Claim:** The aria-live="polite" attribute sits on the <ul> of missing requirements, which is unmounted and replaced by a non-live <p> when readiness flips to ready, so the moment the last requirement is satisfied is exactly the change that is never announced.
**Scenario:** An analyst using a screen reader saves the final missing field; CR-01's refresh updates readiness, the missing-items list disappears and 'All release requirements are present' renders in a plain paragraph outside any live region — the analyst hears nothing and doesn't know release has become available.

## 14. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** exemptionReviewDate field (line 197)
**Claim:** Exemption review date is a free-text input whose only format guidance is a placeholder 'YYYY-MM-DDTHH:mm:ssZ' that disappears on first keystroke, requiring hand-typed ISO-8601 datetimes with no persistent hint text or datetime control.
**Scenario:** An analyst types '29/08/2026' (the en-AU format every read view on the page uses), the placeholder is gone so the expected format is invisible, and per the field-error finding the server rejection surfaces only as a generic banner — an effectively unusable field for the one datetime the risk allowlist accepts.

## 15. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** status Badge (line 160); also assessment-list.tsx lines 120/123
**Claim:** The raw workflow token (e.g. 'in-review', 'draft') is rendered verbatim in the status badge instead of a sentence-case human label, and the same generic CheckCircle2/Clock3 icon is used regardless of status, so status is differentiated by machine-string only.
**Scenario:** An analyst opens the review queue and sees badges reading 'in-review' with a check-circle icon — hyphenated lowercase machine vocabulary in the UI, and the icon (a completion mark) contradicts the in-progress state, muddying the icon+label status system the design mandates.

## 16. [minor] apps/web/app/(app)/app/review/assessments/page.tsx
**Locus:** route directory (review/assessments and review/assessments/[documentId] have no loading.tsx or error.tsx)
**Claim:** The two new analyst review routes ship without route-level loading.tsx/error.tsx files (unlike the sibling review/questionnaires routes), so an unexpected render/throw escapes to the distant /app segment boundary and loses the route's page-header context.
**Scenario:** A malformed service response throws while streaming AssessmentEditorContent; with no local error boundary the whole /app segment is replaced by the generic top-level error UI with no 'Risk assessment review' context or route-scoped retry, an inconsistent error state compared with the questionnaire review routes that define both files.

## 17. [blocker] apps/strapi/src/policies/csrm-authorization.ts
**Locus:** SECURITY_ANALYST_ROLE_NAMES (lines 4-7) together with the release route policy in apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts (POST /v1/risk_assessments/:assessmentId/release) and the seeded grant graph in apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json (function.risk_assessments.risk_assessment_details.api.08)
**Claim:** An identity holding the seeded "Security Analyst Agent" (AI) role can execute the explicit release route and become the recorded approver, because the policy treats that role identically to the human "Security Analyst" role and the canonical catalogue grants it POST:/api/v1/risk_assessments/{assessmentId}/release, violating the phase invariant that AI can never release (REQUIREMENTS INT-03: "never release an assessment automatically").
**Scenario:** A service identity is provisioned with the catalogue-seeded "Security Analyst Agent" role (accountStatus active). It POSTs /api/v1/risk_assessments/{id}/release on a ready in-review assessment: hasExplicitAnalystOperation matches (role name is in SECURITY_ANALYST_ROLE_NAMES and the seeded role graph carries the release URL), assessmentRequestActor is stamped "analyst", assertAnalystAssessmentScope passes, and releaseAssessment atomically sets assessmentStatus=approved with approvedBy=the AI identity — the assessment becomes visible to the requestor with no human analyst involved. The integration suite never catches this because the harness's "analystAgent" identity is deliberately created with roles: [] (apps/strapi/tests/helpers/strapi-http-harness.ts line 275), so the 403 release assertions exercise a role-less user, not a user actually holding the seeded agent role.

## 18. [minor] apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
**Locus:** searchActiveUsers (lines 129-137), route GET /v1/users in apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
**Claim:** The mounted owner-search route hard-denies the Requestor actor via assertAnalystAssessmentScope even though the frozen role/FunctionAPI catalogue grants the Requestor role the identical operation URL GET:/api/v1/users?search={query} (function.risk_assessment_requests.new_request), so the policy authorizes the request and the controller then contradicts the canonical grant contract.
**Scenario:** A user holding only the Requestor role calls GET /api/v1/users?search=ja (the catalogue-granted owner lookup for building a new assessment request): csrm-authorization passes on the Requestor role's explicit URL grant and stamps assessmentRequestActor="requestor", then the controller throws AssessmentScopeError(403). The only /v1/users route in the app can therefore never serve a capability the frozen catalogue says the Requestor holds — a server-side contract-conformance gap (fail-closed, so not exploitable, but a real divergence between the authoritative grant graph and the mounted authorization).

## 19. [minor] scripts/verify-phase-04-integrity.test.ps1
**Locus:** lines 34-41, $forbiddenFixtures foreach loop
**Claim:** The hostile-fixture loop never references $fixture — its condition tests the same static string ('Specification changes exceed') six times, so none of the six named contract-mutation fixtures ('changed path', 'changed operationId', 'changed parameter', 'changed request body', 'changed non-200 response', 'unrelated schema') is actually exercised, making the loop assert nothing per fixture.
**Scenario:** If verify-phase-04-integrity.ps1 is edited so its structural comparison stops rejecting, say, a changed operationId or an added unrelated schema (while still containing the failure-message string anywhere in the file), this regression test still passes all six 'fixture' iterations, falsely certifying that hostile specification changes would be rejected.

## 20. [minor] apps/strapi/tests/assessment-workflow.integration.test.ts
**Locus:** lines 446-462 (release-fact PATCH 409 loop) and lines 726-739 (release-ancestor risk-create 409 loop)
**Claim:** These mounted denial loops assert only the 409 status code and error-text hygiene, with no read-back verifying that the released assessment's fields were left unchanged or that no Risk row was created under the released ancestors, so a write-then-deny controller regression would pass undetected.
**Scenario:** If the assessment update or contextual risk-create controller were refactored to persist the write before calling assertMutableAssessment (without transactional rollback), the endpoint would still return 409, this test would stay green, and released (immutable) data would be silently mutated; the later Requestor-read test only checks fixture presence via some(...), so a leaked 'Hostile release mutation' risk under releaseFacts.complete would also go unnoticed — this contrasts with the direct-child PATCH at line 744 and the ControlImplementation DELETE at line 957, which do assert persistence.

## 21. [minor] apps/web/src/features/assessments/assessment-review-workflow.test.tsx
**Locus:** lines 65, 77, 86 in the three 'shows the ... skeleton before its deferred read resolves' tests
**Claim:** The closing assertion expect(result.promise).toBeInstanceOf(Promise) is tautologically true by construction of deferred(), and the tests never resolve the promise, so the Suspense boundary is only verified in its fallback state and the assertion contributes nothing.
**Scenario:** If a change made the suspended component throw on resolution or render the populated list incorrectly after the read completes, these tests would still pass because the promise is never resolved; only the skeleton's role=status assertion carries weight, and the decorative Promise instanceof check gives the appearance of an additional verification that does not exist.

## 22. [blocker] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** lines 94, 126-139 (input aria-activedescendant and CommandItem id/aria-selected)
**Claim:** The combobox's aria-activedescendant points to an element id that never exists in the DOM, and neither the visual highlight nor aria-selected follows arrow-key navigation, because cmdk 1.1.1 overrides the id and aria-selected props passed to CommandItem (its Item spreads user props first, then sets id from radix useId() and aria-selected from its own internal selection state, which stays pinned to the first option since keyboard focus never enters the Command tree).
**Scenario:** A screen-reader analyst types "ja" in the Risk owner field, presses ArrowDown three times: nothing is announced (aria-activedescendant references the nonexistent id `${listboxId}-${documentId}` while the rendered option carries a radix-generated id), the bg-accent highlight (driven by cmdk's data-selected) stays on the first option, and pressing Enter silently selects results[2] — a different owner than the one visually highlighted.

## 23. [major] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** lines 106-109 (Enter key handling in onKeyDown)
**Claim:** Enter in the owner search input is only preventDefault-ed when an active option exists (activeIndex >= 0), so with results visible but no arrow-key navigation yet, Enter falls through to implicit submission of the surrounding RiskEditor/ControlImplementationEditor form.
**Scenario:** An analyst editing a Risk types an owner name, sees the dropdown open with the first option visually highlighted by cmdk, and presses Enter expecting to pick it — instead the entire Risk form submits (saving unrelated in-progress field edits or firing a 'No changes to save' path) and no owner is selected.

## 24. [major] apps/web/src/components/csrm/risk-rating-badge.tsx
**Locus:** lines 18-39 (riskRatingPresentations map)
**Claim:** RiskRatingBadge ignores the dedicated risk-severity token ladder defined in globals.css (--color-risk-low/medium/high/critical, lines 65-73/164-172) and instead renders Moderate with info tokens (interactive blue #1d4ed8), High with warning tokens (the amber #b54708 the design direction assigns to Moderate), and Critical with ad-hoc opacity-modified destructive tokens (bg-destructive/10, border-destructive/40) instead of --color-risk-critical-subtle, violating csrm-design-direction.md §3.6 (severity is a warm-hue ladder, tokens separate from status) and §3.4 (blue is reserved for interactive/info; a severity blue breaks the one-accent rule).
**Scenario:** On the requestor dashboard rating summary and every risk card, a Moderate risk renders as a blue badge that reads as neutral information rather than the second rung of the severity ladder, while High renders in the exact amber designed to mean Moderate — a user triaging by color-plus-position misorders High below where Moderate should sit, and the ladder is not monotonically orderable (green → blue → amber → red); the badge also omits the doc-mandated non-visual order cue (aria-label "Severity: critical (4 of 4)").

## 25. [major] apps/web/src/features/assessments/control-implementation-editor.tsx
**Locus:** lines 89-92 (submit error handling)
**Claim:** ControlImplementationEditor discards result.fieldErrors returned by create/updateControlImplementationAction (which produce per-field Zod messages, e.g. invalid reviewDate via validationFailure in assessment-actions.ts lines 87-110) and surfaces only the generic formError, so field-level validation failures are never attributed to a field (WCAG 3.3.1 error identification).
**Scenario:** An analyst enters a malformed Review date among the eight mitigation-control fields and saves; the only feedback is the top-level alert "Check the assessment details and try again." with no indication of which field is wrong, no aria-invalid, and no inline message — unlike RiskEditor and AssessmentMetadata which map fieldErrors onto the form.

## 26. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** line 186 (field error rendering; same pattern at assessment-editor.tsx line 275 and confirm-dialog.tsx line 70)
**Claim:** Inline field errors are rendered as red text alone — no leading icon and no aria-invalid on the failing control (only the assessment Summary field sets aria-invalid) — violating the design direction Forms rule 'Red is never the only signal (icon + text always)' and do-not #1, and leaving controls without programmatic invalid state or aria-describedby error association.
**Scenario:** A color-blind analyst submits a risk with a rejected riskStatement: the only added signal is a small red-tinted text line whose color they cannot distinguish from hint text, and their screen reader never hears the input flagged invalid because aria-invalid/aria-describedby are absent on the input.

## 27. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** line 197 (Exemption review date input)
**Claim:** Exemption review date is a plain text input whose required 'YYYY-MM-DDTHH:mm:ssZ' format is communicated only via placeholder (which disappears on input), while every sibling date field uses type="date" — placeholder-as-instruction contradicts the design direction Forms rule and WCAG 3.3.2 guidance.
**Scenario:** An analyst starts typing an exemption review date, loses the format hint the moment the first character lands, enters '31/12/2026', and gets a validation rejection with no visible statement of the expected datetime format anywhere on the form.

## 28. [minor] apps/web/src/features/assessments/assessment-list.tsx
**Locus:** lines 120 and 123 (status badges in mobile cards vs desktop table)
**Claim:** Assessment status badges show a fixed icon that ignores the actual status and disagrees between breakpoints — Clock3 for every status on mobile, CheckCircle2 for every status on desktop — and display the raw machine enum ('in-review', 'draft') instead of a human label, so the icon+label pairing the design system relies on conveys wrong or contradictory meaning (assessment-editor.tsx line 160 similarly pins CheckCircle2 to draft/in-review states).
**Scenario:** An analyst sees a draft assessment with a green-check-style CheckCircle2 badge reading 'draft' in the desktop review queue, interprets it as completed work, then opens the same queue on a phone where the identical record now shows a clock icon — the non-color signifier (the icon shape) actively miscommunicates workflow state in both places.

## 29. [major] apps/web/src/components/csrm/risk-rating-badge.tsx
**Locus:** riskRatingPresentations, lines 18-39
**Claim:** The severity badge ignores the defined risk-severity token ladder (--color-risk-* in app/globals.css:65-73,164-172) and instead maps Moderate to the interactive/info blue family and Critical to destructive opacity modifiers (bg-destructive/10, border-destructive/40), producing non-token colors and breaking the amber->orange->red severity ordering mandated by design direction sections 3.6 and 6.2/6.15.
**Scenario:** An analyst scanning the Identified Risks list or the dashboard rating summary sees Moderate risks in the same blue used for links, primary buttons, and info status, so Moderate reads as neutral information rather than the second rung of the severity ladder, and High (amber warning tint) appears visually more severe than Moderate; the Critical tint at 10% destructive opacity also shifts with any surface it sits on, diverging from the AA-verified #912018-on-#FEE4E2 pair the tokens define.

## 30. [major] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** Popover open={open} (line 86) with no onOpenChange
**Claim:** The results popover's open state is derived solely from the query text and the Radix Popover has no onOpenChange handler, so outside clicks, Tab, and blur never dismiss the listbox — it stays floating over the fields below until the user clears the input or presses Escape while focused inside it.
**Scenario:** An analyst types 'jo' in the Risk owner combobox, decides not to pick anyone, and clicks into the Treatment plan textarea; the owner results popover remains open, overlapping and obscuring the next form controls, and keyboard users who Tab away carry on with a stale expanded listbox (aria-expanded=true) they can no longer close except by refocusing the input.

## 31. [major] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** ArrowDown/ArrowUp handling (lines 97-117) with CommandItem aria-selected (line 134)
**Claim:** Arrow-key navigation only updates a local activeIndex/aria-selected attribute, but the visible highlight on shadcn CommandItem is driven by cmdk's internal data-[selected=true] state (src/components/ui/command.tsx:150), which never changes because focus stays on the external input — so sighted keyboard users get no visual indication of the active option and aria-activedescendant diverges from the visible highlight.
**Scenario:** A keyboard-only analyst presses ArrowDown three times in the owner results list: cmdk keeps its default highlight on the first item (or none) while aria-activedescendant points at the fourth, so pressing Enter selects an owner different from the one that appears highlighted, and there is no visible cue of which option Enter will choose.

## 32. [minor] apps/web/src/features/assessments/owner-combobox.tsx
**Locus:** debounce effect (lines 56-68) and empty-state branch (line 123)
**Claim:** During the 300ms debounce window results are cleared and isLoading is still false, so the popover renders the false empty state 'No matching active owners.' (a role=status live region) on every keystroke before the search has even started.
**Scenario:** An analyst types 'smith' at normal speed: after each keystroke the popover flashes 'No matching active owners.' for up to 300ms and the role=status region re-announces it to screen-reader users repeatedly, telling them their real owner does not exist while the search is merely pending.

## 33. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** field error spans (line 186) and inputs (lines 184-185); also assessment-editor.tsx lines 275-280
**Claim:** Validation error messages are rendered as color-only text spans with no icon, no aria-describedby linking them to their control, and no aria-invalid on the Risk editor inputs (only the assessment Summary textarea sets aria-invalid), violating the design direction's error recipe (icon + text, danger border) and the lens requirement of aria-describedby wiring.
**Scenario:** The server rejects a too-short risk statement; a screen-reader user focused on the Risk statement textarea hears no invalid state and no error text because the message span is not referenced by the control, while a low-vision or colorblind user sees only a small red-tinted sentence with no icon to distinguish it from helper text.

## 34. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** release readiness card, lines 177-181
**Claim:** The aria-live=polite region is the missing-requirements <ul> itself, which unmounts and is replaced by a non-live <p> when readiness becomes ready, so the key transition to 'All release requirements are present.' is never announced to assistive technology.
**Scenario:** An analyst using a screen reader fills the last missing field and saves; the readiness panel silently swaps the live list for the static ready paragraph, so they receive no announcement that release is now possible and must manually re-scan the page to discover the enabled Release assessment button.

## 35. [minor] apps/web/src/features/assessments/assessment-list.tsx
**Locus:** status badges lines 120 and 123; also assessment-editor.tsx line 160 and assessment-detail.tsx line 51
**Claim:** Raw workflow enum values ('draft', 'in-review', 'approved', 'submitted') are rendered verbatim as user-facing badge text instead of the sentence-case presentation labels used elsewhere (StatusBadge/requestStatusPresentation), and the paired icon is fixed regardless of state (CheckCircle2 on every desktop row and on the request-review header, Clock3 on every mobile card), so the icon carries no state meaning.
**Scenario:** An analyst opens the review queue and sees a draft assessment tagged 'in-review' in lowercase machine casing next to a green-check icon on the desktop table but a clock icon for the same status on mobile, while every other status badge in the product (dashboard, request lists) shows 'Under review'-style labels with state-specific icons — the same record reads as differently-styled, ambiguous states across views.

## 36. [minor] apps/web/src/components/csrm/risk-rating-badge.tsx
**Locus:** Badge render, lines 45-50
**Claim:** The severity badge omits the design direction section 3.6 mandatory orderable non-visual label (aria-label="Severity: critical (4 of 4)"), exposing only the bare word to assistive technology so the ladder position is not conveyed non-visually.
**Scenario:** A screen-reader user comparing two risks hears only 'High' and 'Moderate' with no indication these are points 3 and 2 on a 4-point ordered severity scale, information sighted users infer from the color/darkness progression.

## 37. [minor] apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx
**Locus:** route segment directories app/(app)/app/review/assessments and app/(app)/app/review/requests (no error.tsx/loading.tsx)
**Claim:** All four new analyst review routes ship without route-level error.tsx (and loading.tsx), unlike the sibling review/questionnaires and requestor assessments segments, so an unexpected render/exception (anything not returned as a typed service error, e.g. a thrown fetch failure inside the Suspense content) falls back to the generic /app segment error boundary that loses the page's context and recovery copy.
**Scenario:** getAnalystAssessment throws (network abort rather than a typed error result) while an analyst opens an assessment: instead of the route's contextual 'We couldn't load this assessment' state with a path back to the queue, the whole /app segment is replaced by the generic app-level error boundary.

## 38. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** statusMessage render, line 178; same pattern in control-implementation-editor.tsx line 111
**Claim:** The 'No changes to save.' confirmation is a live region that is conditionally mounted together with its content (aria-live inserted at the same instant the text appears), a pattern most screen readers do not announce because the live region did not exist before its content changed.
**Scenario:** An analyst submits a Risk form with no edits; sighted users see 'No changes to save.' but a screen-reader user hears nothing, concludes the save is still pending or silently succeeded, and cannot tell why the persisted data never changes.

## 39. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** Release readiness card, line 175; also assessment-draft-job.tsx line 195
**Claim:** The Release readiness panel and the Deterministic draft assistance panel title their cards with CardTitle (a div), contributing no heading element, while sibling sections on the same pages use real h2s via DetailSection — these key panels are invisible to heading-outline navigation.
**Scenario:** A screen-reader user navigating the assessment editor by headings jumps from 'Assessment details' (h2) straight to 'Identified Risks' (h2) and never lands on the Release readiness panel that gates the release action, having no heading-level way to reach the release workflow.

## 40. [minor] apps/web/src/features/assessments/risk-editor.tsx
**Locus:** Exemption review date field, line 197
**Claim:** Exemption review date is a free-text input whose only format guidance is the placeholder 'YYYY-MM-DDTHH:mm:ssZ', while every other date on the form uses type=date — placeholder-as-instruction disappears on input, contradicting the design direction's 'placeholder never a substitute' rule and inviting format errors with no visible hint text.
**Scenario:** An analyst starts typing an exemption review date, the placeholder vanishes, and they must guess whether seconds and the trailing Z are required; on submit the server rejects the value and, because the hint lived only in the now-hidden placeholder, they have no on-screen reference for the expected datetime format.

## 41. [major] apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
**Locus:** generate() — `if (risks.length === 0) throw new Error("CSRM assessment draft has no applicable risk mappings.")` (line 149), reached via persistAssessmentDraft in assessment-workflow.ts
**Claim:** A validly submitted questionnaire that matches none of the three deterministic risk mappings permanently dead-ends the request workflow: draft generation always fails, retry always fails identically, and no other path can create an assessment or advance the request past questionnaire-in-progress.
**Scenario:** Requestor submits the questionnaire with hosting-model=organisation, no production URL (optional), handles-personal-data=false, and no third-party providers (optional) — all legal answers. Analyst clicks 'Start deterministic draft assistance'; the provider throws, the plain Error is masked by safeFailure() into the generic 'Assessment draft generation failed safely.' with code DRAFT_GENERATION_FAILED, and 'Retry draft assistance' deterministically fails forever. The request can never reach risk-assessment-drafted/under-review/approved because risk creation requires an existing assessment and assessments are created only by this job.

## 42. [minor] apps/web/src/features/assessments/assessment-editor.tsx
**Locus:** readinessLabels / readinessLabel() (lines 48-74) and the missing-requirements list anchor `missing.startsWith('assessment.')` (line 179)
**Claim:** The release-readiness UI was built against a missing-path format ('assessment.summary', 'risks.0.riskStatement') that the server never emits — the server's validateReleaseReadiness (apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts lines 151-155) emits bare keys ('summary', 'overallRating', 'overallRiskRationale', 'reviewedBy', 'assessmentStatus') and bracket indices ('risks[0].x'), so assessment-level gaps render as raw camelCase field names and link to the wrong section.
**Scenario:** Analyst opens a draft assessment with an empty summary. The 'Release readiness' card lists literal items 'assessmentStatus', 'summary', 'overallRating', 'overallRiskRationale', 'reviewedBy' instead of the friendly labels ('Summary', 'Overall rating', 'Reviewer'), and each links to '#identified-risks' instead of '#assessment-details' because none of the server keys start with 'assessment.'. The unit tests (assessment-editor.test.tsx lines 417, 437) pass only because they feed the fictional 'assessment.*'/'risks.0.*' fixture shape the server never produces.

## 43. [minor] apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts
**Locus:** enqueue() cross-analyst check (lines 177-186): `if (existing.initiatingAnalystDocumentId !== input.initiatingAnalystDocumentId) throw new AssessmentDraftRegistryError(403, ...)`
**Claim:** Generation is documented as idempotent ('The generation endpoint returns the existing active or completed job for the questionnaire rather than scheduling a duplicate' — docs/contract-gaps/phase-04-deterministic-draft-jobs.md), but when a second authorized analyst calls generate for the same questionnaire the registry returns 403 instead of the existing job, blocking that analyst for up to the 1-hour terminal TTL.
**Scenario:** Analysts A and B both work the shared review queue (collection scope 'all'). A starts draft generation; the job completes and stays in the in-memory registry. Within the TTL, B opens the same request and clicks 'Start deterministic draft assistance' — POST /v1/questionnaires/{id}/generate_assessment returns 403 and the web action surfaces the misleading 'You do not have permission to change this assessment.', even though B holds the exact analyst generate grant and the operation would be a no-op returning the existing assessment.

## 44. [minor] apps/web/src/config/navigation/navigation.ts
**Locus:** navigation array (lines 3-11)
**Claim:** Neither the analyst assessment review queue (/app/review/assessments, served by apps/web/app/(app)/app/review/assessments/page.tsx) nor the requestor released-assessment inventory (/app/assessments, served by apps/web/app/(app)/app/assessments/page.tsx) has any navigation entry or in-app forward link, so both delivered list pages are unreachable except by typing the URL or via back-links from detail pages.
**Scenario:** An analyst who did not just complete a draft job (e.g., resuming review of an in-review assessment next day) has no UI path to the assessment queue: the nav offers only 'Assessment Requests' and 'Questionnaires', and the request detail only links to the questionnaire and the job card. Similarly, a requestor with more than the 5 dashboard-widget items has no link to the full released list — only the 'Back to released assessments' link inside a detail page they can only reach through the widget's individual items.

## 45. [minor] apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
**Locus:** persistAssessmentDraft() risk creation loop (lines 590-616) — proposal.risks[].suggestedControlNumbers is never persisted, projected, or surfaced
**Claim:** The deterministic provider's per-risk suggestedControlNumbers (derived from RiskType.applicableControls and validated by parseAssessmentDraftProposal) are silently discarded at persistence, while every generated risk's treatmentPlan text instructs the analyst to 'Review the suggested reusable controls' — suggestions that exist nowhere in any API projection or UI.
**Scenario:** Draft generation runs for a cloud-hosted service; the Internet Exposure risk is created with treatmentPlan 'Review the suggested reusable controls and record the analyst-approved treatment plan.', but the suggested controls (e.g., E8-PATCH_APPLICATIONS-003, V3.1.1) are dropped: they are not stored on the Risk, not in the job projection, and not in the analyst detail DTO. The analyst opens the editor, finds no suggested controls anywhere, and must guess which of the full 5,000-row control list the deterministic mapping intended — making the applicable-controls derivation and its sorting/validation effectively dead code.

