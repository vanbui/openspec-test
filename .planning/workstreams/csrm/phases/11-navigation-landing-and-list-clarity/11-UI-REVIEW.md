# Phase 11 — UI Review

**Audited:** 2026-10-04
**Baseline:** Approved `11-UI-SPEC.md`; authoritative `docs/design/csrm-design-direction.md`
**Screenshots:** not captured (no dev server at localhost:3000, 5173 or 8080)
**Interaction captures:** off (workflow.ui_interaction_capture is false)

This is a bounded code audit supplemented by the historical pilot-approved browser walk in `11-21-SUMMARY.md` (B1–B3 and W1–W26, 375/1440 widths), and independent current regression evidence supplied by the orchestrator. No screenshots or interactions were captured by this audit. Scores assess the examined implementation; they do not certify fresh pixel conformance or the pending manual checks. Screenshot ignore patterns were verified before server detection. Read/write tools were unavailable in this runtime; shell reads and the file-edit tool were used.

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| Copywriting | 4/4 | Home and quick-find strings follow the locked vocabulary and recovery copy. |
| Visuals | 4/4 | Source hierarchy, actor sections and phone/desktop composition match the contract; historical walk supports the specified folds. |
| Color | 4/4 | Audited feature components consume semantic tokens; no new raw brand colours or accent hue found. |
| Typography | 4/4 | Body, caption, micro-label and heading pairs use the declared scale. |
| Spacing | 4/4 | Home uses declared steps and gutters; quick-find frame follows X-8. |
| Experience Design | 3/4 | State and recovery paths are implemented, but required manual accessibility/platform/UAT evidence remains pending. |

**Overall: 23/24**

No new confirmed implementation BLOCKER was established. The three WARNINGs below are verification gaps, not claims of observed broken behavior. Passing pillars have specific conformance findings below; scores were not reduced for speculative style preferences.

## Top 3 Priority Fixes

1. **UI11-W01: Complete NVDA verification** — count meaning, disclosure state and search announcements are not proven in the required assistive technology — run the `11-VALIDATION.md` NVDA/Chrome checks and record actual spoken output; repair any observed failure.
2. **UI11-W02: Complete macOS shortcut verification** — Chromium and unit evidence cannot establish Safari/Firefox handling — verify ⌘K open/close, text-field invocation and focus restoration in both browsers and record results.
3. **UI11-W03: Run operator UAT baselines** — seeded stand-ins do not establish the original UAT-A/B/C records — repeat the named Home, triage, Released-label and exposure checks against those records and attach outcomes.

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**Conformance finding:** `src/features/home/requestor-home-presentation.ts:75` onwards centralises “Needs your action”, “With the Security Analyst”, “Released assessments”, section empty/error copy and `Return to sign in`; these match UI-SPEC §5.2/§5.4. `src/features/quick-find/quick-find-domain.ts:143` onwards implements the exact hint, quoted no-match message, named partial failure and `Retry search` wording of §4.4. The approved walk records Released labels in W4/W7. Review disposition WR-203/WR-205 records repaired refusal recovery and permission-dependent creation actions. No generic new Submit/OK recovery label was identified in these surfaces.

### Pillar 2: Visuals (4/4)

**Conformance finding:** `src/features/home/home-section.tsx:62`–75 establishes icon → h2 → description → body, with a named section. The Requestor grid at line 29 is one column until lg, then two; `requestor-home.tsx:195` spans Released assessments across both. Navigation uses one `Primary navigation` landmark, capability-filtered named groups, a primary action and the personal-section disclosure (`src/components/shell/capability-navigation.tsx`). This corresponds to §1.2 and §5.2. Quick-find options preserve full DOM text while clamping visual title lines (`app/globals.css:938`). Historical B/W evidence and the supplied current Home fold proofs support 375/1440 composition; no fresh screenshot judgment is claimed.

### Pillar 3: Color (4/4)

**Conformance finding:** The production TSX scan of Home, quick-find and shell found zero raw hex/rgb colour call sites and one primary-family utility call site: `home-page-header.tsx:23` applies semantic `text-primary-foreground` to the declared New request button. Shared Button/RiskRatingBadge primitives provide their semantic treatments. `home-section.tsx:62`–68 uses border, foreground and secondary tokens; `app/globals.css:818`–823 uses border/surface/shadow tokens for the overlay, and line 927 uses secondary text for groups. The design explicitly has no accent hue; a generic 60/30/10 chromatic quota would contradict its binding value authority. Physical surface distribution was not measured without screenshots.

### Pillar 4: Typography (4/4)

**Conformance finding:** Production Home/quick-find/shell TSX uses `text-xs`, `text-sm`, `text-button`, `text-heading-sm` and explicit `font-medium`; `.micro-label` supplies the declared mono treatment. These are named contract roles, not an undeclared expansion of the type scale. `app/globals.css:309`–324 maps button weight 500, small/medium heading weight 600 and wordmark weight 400; the shared frame uses `text-heading-sm`, body and caption roles (`home-section.tsx:66`, 68, 88). Quick-find secondary lines use caption text (`quick-find-dialog.tsx:373`). Font loading/rendering was not independently observed in this audit.

### Pillar 5: Spacing (4/4)

**Conformance finding:** `home-section.tsx:29`, 32, 62–75 and 87–90 uses gutter tokens and 4/8/16/20px rhythm through gap-1/2, mt-4, py-4/5 and px-5. `app/globals.css:825`–831 implements the contract's 640px desktop quick-find panel anchored at header plus 48px and a viewport-dependent result list. Its mobile media rule gives the full-screen layout. These intentional X-8 dimensions are contract values, not arbitrary-spacing defects.

The confirmed prior desktop filter overflow (FT-01) is repaired at `src/features/risks/risk-register-filters.tsx:263`: Radix available-height maximum plus `overflow-y-auto`. Supplied independent rebuilt-CSS Chromium evidence measured a 637px panel with 1138px scroll content and the last control inside a 900px viewport; supplied current production regression passes at 900 and 600 heights. The accepted 256px-height observation IN-204 is not promoted into a specified-viewport blocker.

### Pillar 6: Experience Design (3/4)

**Conformance finding:** Home isolates section failure with `RetryableErrorState` (`requestor-home.tsx:196`); quick find covers delayed skeletons, busy/pending results, partial/all failure retries and one polite announcement (`quick-find-dialog.tsx:334`–387), with the 100-character bound at line 319. The existing navigation guard remains the seam for unsaved answers. Review disposition records repaired retry boundaries (WR-202), analyst route gates (WR-204), repeated announcement identity (WR-201), debounce pending state (WR-206), cold input bound (IN-203) and identity cache (SH-01). Current production regressions supplied by the orchestrator pass filter scrolling, midnight-zone rendering and identity switching; the broader final browser gate remains the orchestrator's responsibility.

- **WARNING UI11-W01:** NVDA output is pending (`11-21-SUMMARY.md:222`). ARIA source and Chromium inspection support implementation, but do not replace spoken-output verification required by the validation contract.
- **WARNING UI11-W02:** macOS Safari/Firefox ⌘K is pending (`11-21-SUMMARY.md:223`). No failure is asserted; actual platform evidence is missing.
- **WARNING UI11-W03:** Original UAT-A/B/C baselines are pending (`11-21-SUMMARY.md:224`). W27 states those records were unavailable in the walk database. Seeded equivalents cannot be reported as those baselines passing.

## Registry Safety

Registry audit: 0 third-party blocks checked, no flags. `apps/csrm/components.json` exists; UI-SPEC Registry Safety lists only shadcn official local source-owned components, no fetched third-party block. No registry network command was needed.

## Files Audited

Paths below are relative to `apps/csrm/` unless stated otherwise.

- `src/features/home/{requestor-home.tsx,requestor-home-presentation.ts,home-section.tsx,home-page-header.tsx}`
- `src/components/shell/capability-navigation.tsx`, `quick-find-trigger.tsx`
- `src/features/quick-find/{quick-find-dialog.tsx,quick-find-domain.ts}`
- `src/features/assessments/assessment-list.tsx`
- `src/features/risks/risk-register-filters.tsx`
- `src/components/states/states.tsx`, `src/components/ui/popover.tsx`
- `app/globals.css`, `components.json`
- Root `AGENTS.md`, `docs/design/csrm-design-direction.md`
- Phase `11-UI-SPEC.md`, decision references in `11-CONTEXT.md`, `11-21-SUMMARY.md`, `11-REVIEW-DISPOSITION.md`

**Recommendation count:** 3 priority verification warnings; 0 new confirmed implementation blockers; 0 additional minor recommendations.
