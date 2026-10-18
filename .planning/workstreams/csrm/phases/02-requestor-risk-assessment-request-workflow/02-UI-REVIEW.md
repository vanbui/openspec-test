# Phase 2 — UI Review

**Audited:** 2026-09-10
**Baseline:** No phase-specific UI-SPEC.md exists. Audited against the Phase 1 app-wide UI-SPEC.md (design tokens, 4/8/16/24/32/48/64 spacing scale, 14/16/20/28px + 400/600 typography ramp, 60/30/10 color, state-copy contract) plus abstract 6-pillar standards for anything the Phase 1 contract doesn't cover (form/validation UX, table UX).
**Screenshots:** Not captured — no dev server running at localhost:3000/3100/5173/8080. Code-only audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Error/validation/empty copy is plain-language and specific, but the dashboard error/permission states silently drop the required "Try again" retry action and diverge in wording from the shared state contract used elsewhere. |
| 2. Visuals | 3/4 | Clear hierarchy and restrained decoration, but two visibly different empty/error/permission state treatments exist for the same concept (shared `.state` primitive vs. bespoke Tailwind cards in `request-table.tsx`), undermining a single consistent pattern. |
| 3. Color | 3/4 | No hardcoded hex/rgb found; tokens used correctly. Status/risk badges pair color with icon+label as required. No blocking issues found. |
| 4. Typography | 2/4 | Systematic violations of the locked 14/16/20/28px + 400/600 ramp: `text-xs`(12px), `text-lg`(18px), `text-2xl`(24px), and `font-medium`(500) are used pervasively across `request-form.tsx`, `request-table.tsx`, `requestor-dashboard.tsx`, and the request detail page. All-caps `uppercase tracking-wide` labels appear repeatedly despite an explicit spec prohibition. |
| 5. Spacing | 2/4 | Off-scale spacing values (`gap-3`/12px used 8×, `px-3`/`p-3`/12px, `p-5`/`px-5`/20px used 5×) appear throughout the requests and dashboard feature code, breaking the declared 4/8/16/24/32/48/64px scale. |
| 6. Experience Design | 3/4 | Strong state coverage (loading/error/empty/permission/first-use) and a genuinely good irreversible-submit confirmation flow with repeat-lock and accessible retry, but client-side validation on plain "Save draft" submit has no announced error summary, and dashboard error/permission states omit retry affordances that the sibling list-page states provide. |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Typography ramp violation across every Phase 2 screen** — Users see inconsistent, off-spec text sizing (12px/18px/24px alongside the approved 14/16/20/28px) and an unapproved font-weight (`font-medium`/500) mixed with the two approved weights (400/600), which erodes visual consistency and will compound as more phases reuse these patterns. Fix: replace `text-xs`→`text-sm`, `text-lg`→`text-heading`(20px) or `text-base`, `text-2xl`→`text-display`(28px) or a bounded custom "value" size actually added to the design tokens, and replace `font-medium` with `font-semibold` or plain `font-normal` throughout `apps/web/src/features/requests/request-form.tsx`, `request-table.tsx`, `apps/web/src/features/dashboard/requestor-dashboard.tsx`, and `apps/web/app/(app)/app/requests/[documentId]/page.tsx`.

2. **All-caps labels used repeatedly despite an explicit spec prohibition** — `apps/web/app/(app)/app/requests/[documentId]/page.tsx:18` (`DetailItem` — `uppercase tracking-wide`) and `apps/web/src/features/requests/request-form.tsx:308` (`Contextual Risks by residual rating` label) render field labels in all caps. The Phase 1 UI-SPEC is explicit: "do not use all-caps text for labels or navigation." This is a direct contract violation affecting every request detail page. Fix: drop `uppercase tracking-wide` and use `text-sm font-semibold text-muted-foreground` sentence-case labels instead.

3. **Off-scale spacing throughout requests/dashboard feature code** — `gap-3` (12px) is used 8 times, `p-3`/`px-3` (12px) several times, and `p-5`/`px-5` (20px) used 5 times in `request-form.tsx`, `request-table.tsx`, and `requestor-dashboard.tsx`, none of which are on the declared 4/8/16/24/32/48/64px scale. Fix: normalize to `gap-2`(8px)/`gap-4`(16px) and `p-4`(16px)/`p-6`(24px) equivalents, or formally extend the spacing scale in a future UI-SPEC if 12px/20px density is intentionally needed for dense card/badge layouts.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Strengths:
- `request-actions.ts:24-36` maps every mutation failure (400/403/404/409/transport) to specific, plain-language, non-technical copy ("This request changed while you were editing it. Reload and try again.") — no stack traces, URLs, or internal error codes leaked.
- `confirm-dialog.tsx` submission copy is explicit and irreversible-aware: "Submission is irreversible. This request cannot be edited after submission."
- `request-table.tsx:65-103` distinguishes first-use empty state ("Create your first assessment request") from filtered-empty state ("No requests match these filters") per UX best practice, going beyond the generic Phase-1 empty-state copy.

Issues:
- `requestor-dashboard.tsx:223-241` `DashboardErrorState`/`DashboardPermissionState` render only a heading, body copy, and a single navigation link — no **Try again** retry action, unlike the Phase 1 contract's error-state requirement ("Include a visible Try again action that retries only the failed request") and unlike the sibling `RequestErrorState` in `request-table.tsx:85-93`, which does provide `onClick={retry}`.
- Two different copy voices exist for conceptually identical error states: the shared `states.tsx` ErrorState says "Please try again. If the problem continues, contact your administrator." while `request-table.tsx`'s bespoke `RequestErrorState` says "Try again. If the problem continues, contact your administrator." — near-identical but not byte-identical, suggesting drift rather than a single source of truth.

### Pillar 2: Visuals (3/4)

Strengths:
- Dashboard (`requestor-dashboard.tsx`) has one clear focal point per card (count badge top-right, list below), consistent icon+label patterns, and restrained card elevation consistent with the token contract.
- Icon-only affordances are paired with visible text (status badges always render icon + label; `aria-hidden` used correctly on decorative icons).
- Relationship tiles (`request-form.tsx:306-316`) use a residual-risk grid that reads clearly with rating badges + numeric counts.

Issues:
- Two structurally different empty/error/permission-state visual treatments coexist for the same domain concept: the shared `.state` CSS-class primitive (bordered card, centered, 48px/24px padding) used by `states.tsx` and dashboard, versus ad-hoc Tailwind `<section className="space-y-2 text-center">` markup with different heading size (`text-lg` vs the primitive's 16px `h2`) in `request-table.tsx`. This is a visible inconsistency a user would notice moving between My Requests and the dashboard.
- `AssessmentRelationshipTile` (`request-form.tsx:308`) is written as one dense single-line JSX return with no line breaks, making the actual rendered visual structure hard to verify by inspection — a maintainability/reviewability smell that increases the odds of an unnoticed visual regression.

### Pillar 3: Color (3/4)

- `grep` across `features/requests` and `features/dashboard` found zero raw hex/`rgb()` literals — all color driven through semantic Tailwind utility classes and CSS custom properties (`bg-surface-muted`, `text-foreground-secondary`, `border-info-border`, etc.), consistent with the D-09 "no raw color in TSX" contract.
- Status/risk color is always paired with an icon and a text label (`status-badge.tsx:74-87`, `QuestionnaireStateBadge` in the dashboard) — satisfies "colour alone never conveys state."
- Accent (`primary`) usage was not found overused as decoration; primary CTA usage (`New request`, `Submit request`) is limited to actionable buttons/links, consistent with the "one primary CTA per view" rule.
- No blocking issues found for this pillar; not scored 4/4 because the audit could not verify actual rendered contrast (no dev server/screenshots), so AA contrast compliance for the newer `text-foreground-secondary`/`info`/`warning` combinations used heavily on the dashboard is unverified rather than confirmed.

### Pillar 4: Typography (2/4)

Evidence — distinct font sizes found in the audited feature files: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl` (5 distinct sizes; spec allows exactly 4 named roles mapping to 14/16/20/28px). Distinct weights found: `font-medium`, `font-semibold` (spec allows exactly 400 and 600; Tailwind's `font-medium` is 500, a third weight not in the contract).

- `apps/web/src/features/dashboard/requestor-dashboard.tsx:121,153` use `text-base` (16px, fine) for `h2` card headings, but the spec's Heading role is 20px — card headings should use the 20px Heading role, not Body-sized text, since they are structural section headings.
- `requestor-dashboard.tsx:127,159` use `text-2xl` (24px) for count badges — 24px is not one of the four declared sizes (nearest is Display/28px, which is reserved for "landing/empty-state heading only" per the Phase 1 contract).
- `request-table.tsx:69,78,88,98` use `text-lg` (18px) for empty/error/permission state headings — 18px is off-scale; Phase 1's own `states.tsx` primitive correctly uses 16px for the same role, so the pages built in this phase deviate from the phase's own established pattern.
- `font-medium` (500 weight, not 400 or 600) appears 11+ times across `request-form.tsx`, `request-table.tsx`, `requestor-dashboard.tsx`, and `confirm-dialog.tsx` (e.g. `request-table.tsx:196`, `requestor-dashboard.tsx:67,86,123,155,161,194,196`).
- `request-form.tsx:308` and `app/(app)/app/requests/[documentId]/page.tsx:18` use `uppercase tracking-wide` for field/section labels, directly violating "do not use all-caps text for labels or navigation."

### Pillar 5: Spacing (2/4)

Spacing-class census across `features/requests`, `features/dashboard`, and the shared `csrm` components used by this phase: `gap-2`(×12), `gap-4`(×8), `gap-3`(×8), `space-y-2`(×6), `px-5`(×4), `space-y-1`(×3), `p-4`(×3), `mt-1`(×3), `py-5`(×2), `py-4`(×2), `px-3`(×2), `gap-y-1`(×2), `gap-x-4`(×2), `gap-8`(×2), `gap-6`(×2), `p-5`(×1), `p-3`(×1), `mt-2`(×2), `mt-3`(×1), `mb-1`(×1).

- `gap-3` (12px, ×8 occurrences) and `px-3`/`p-3` (12px, ×3) are not on the declared 4/8/16/24/32/48/64px scale.
- `p-5`/`px-5` (20px, ×5 occurrences, all in `requestor-dashboard.tsx` card padding) is also off-scale.
- No arbitrary bracket values (`[Npx]`) were found — spacing deviations are all standard Tailwind steps that simply don't map to the declared token set, suggesting the deviation is unintentional drift rather than a deliberate exception.
- Positive: `min-h-9`/`min-h-11` and `h-9` used for form controls approximate but slightly undershoot the declared 44px (`h-11`=44px) minimum touch target in a few places — `ChoiceField`'s native `<select>` (`request-form.tsx:91`, `h-9`=36px) and the status filter `<select>` (`request-table.tsx:165`, `h-9`=36px) are below the 44px minimum interactive-target contract for comfortable/desktop density where the shell elsewhere uses 44px controls.

### Pillar 6: Experience Design (3/4)

Strengths:
- Full state coverage per route: loading skeletons (`app/(app)/app/requests/loading.tsx`, `[documentId]/loading.tsx`), route-level error boundaries (`error.tsx` under both `requests/` and `requests/[documentId]/`), a distinct 404 (`notFound()` on missing/unauthorized-hidden records), and a distinct 403 (`PermissionDeniedState`) — this is thorough.
- Irreversible actions (submit, revert-to-draft) use a genuinely accessible confirmation pattern (`confirm-dialog.tsx`): focus-trapped `AlertDialog`, synchronous repeat-activation lock via `pendingRef`, retains focus/reopens on failure with inline error, and restores trigger focus on close.
- Draft-vs-submitted editability is enforced with a closed `canRequestorEdit(status)` policy on the client for presentation, paired with server-side enforcement — correct defense-in-depth pattern, not a client-only guard.
- `request-form.tsx:168-173` guards double-submission by validating `form.trigger()` before opening the irreversible confirm flow, moving focus back to the invalid field via `focusInvalidAfterDialog` when validation fails inside the dialog.

Issues:
- `saveDraft` is wired via `form.handleSubmit(saveDraft)` (`request-form.tsx:196`) with no `onInvalid` handler — a client-validation failure (e.g. empty required `title`) relies solely on React Hook Form's default per-field focus behavior; there is no announced error summary as the Phase 1 accessibility contract requires ("announces the error summary after submit, and moves focus to the summary or first invalid field"). Only the server-driven `applyActionFailure` path sets a visible `formError` banner — pure client-side validation failures show inline `FormMessage` but no top-of-form summary.
- Dashboard error/permission states (`requestor-dashboard.tsx:223-241`) provide only a single navigation link and no retry action, weakening recoverability compared to the list page's equivalent states.
- `RelationField`'s `fieldset`/`legend` combo (`request-form.tsx:109-147`) is a good accessible pattern, but the inline code comment acknowledging selection-merging complexity ("Selections have to be remembered here...") signals real fragility in the multi-select relation UX for large inventories — worth a follow-up test for the 1,000-item cap declared in `request-schema.ts:60-61`.

---

## Files Audited

- `apps/web/src/features/requests/request-form.tsx`
- `apps/web/src/features/requests/request-table.tsx`
- `apps/web/src/features/requests/request-schema.ts`
- `apps/web/src/features/requests/request-actions.ts`
- `apps/web/src/features/requests/request-domain.ts` (referenced)
- `apps/web/src/features/dashboard/requestor-dashboard.tsx`
- `apps/web/src/components/csrm/status-badge.tsx`
- `apps/web/src/components/csrm/confirm-dialog.tsx`
- `apps/web/src/components/states/states.tsx`
- `apps/web/app/(app)/app/requests/page.tsx`
- `apps/web/app/(app)/app/requests/[documentId]/page.tsx`
- `apps/web/app/(app)/app/requests/new/page.tsx`
- `apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx`
- `apps/web/app/globals.css` (`.state` primitive)
- `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md` (baseline)
- All 12 `02-*-SUMMARY.md` and their referenced plans in `.planning/phases/02-requestor-risk-assessment-request-workflow/`

Registry audit: `components.json` was not checked for third-party registries in this pass (no UI-SPEC.md exists for Phase 2 declaring registry usage, and Phase 1's UI-SPEC restricts the project to shadcn official components with no third-party blocks recorded). No registry safety section is included.
