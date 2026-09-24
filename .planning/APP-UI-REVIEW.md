# Application-Wide UI Review

**Scope:** all 10 executed phases + live browser pass
**Date:** 2026-09-10
**Method:** 10 parallel `gsd-ui-auditor` static audits (one per phase), then a runtime pass against the
running app (Next.js dev on :3000, Strapi on :1337, seeded fixtures, Security Analyst identity).
**Overall:** 167/240 (mean 16.7/24)

Phase 06.5 is excluded — it has no `SUMMARY.md` and has not been executed.

---

## 0. Correction (2026-09-10) — §2 measured against the wrong contract

**§2 below is retracted.** It reports that the design system never matched its own contract, on the
strength of "0 of 179 rendered elements match any contracted pair." That measurement used
`01-UI-SPEC.md:78-85` (four size+weight pairs, two weights) as the baseline. That is not the contract
the product was built to.

`docs/design/csrm-design-direction.md` — 360 lines, referenced by name in the `globals.css` header
comment — is the actual design system. Its §3.10 contracts **nine type tokens and weights
400/500/600**, and its component guidance adds nav items at 13/500. `--text-micro-size: 11px`,
`--text-table-size: 13px`, `--tracking-micro: 0.05em` and weight 500 are faithful implementations of
that document, not drift from it. The ten phase auditors and this roll-up all missed the file.

Re-measured against the real contract:

| Route | Conformance |
|---|---:|
| `/app` | 88% (42/48) |
| `/app/requests` | 97% (63/65) |
| `/app/risks` | 99% (138/140) |
| `/app/review/assessments` | 90% (52/58) |
| `/app/review/questionnaires` | 96% (44/46) |
| `/app/admin/controls` | 99% (236/238) |

The real drift is six elements: `12/600` and `11/400` appear once each on every route (shell-level,
should be `11/500` micro and `12/400` caption), `14/600` ×4 on the dashboard only, and `12/700` ×4 in
`assessment-list.tsx`'s ad hoc table.

**Three further findings change with it:**

- **§3.4 (sidebar targets) is retracted.** `csrm-design-direction.md` specifies "Nav items: 36px
  height, 13px/500". The measured 232×36px is conformant. `01-UI-SPEC.md:109` asks for 44px, but
  it is the stale document. WCAG 2.2 2.5.8 requires 24×24px, which 36px passes.
- **The all-caps conflict resolves the other way.** `csrm-design-direction.md` §2 takes the uppercase
  micro-label deliberately ("the bproton signature, in Inter") and §3.10 sets it at 11px/500/+0.05em;
  `06-UI-SPEC.md:80` agrees. Only `01-UI-SPEC.md:78` forbids it, and it is outvoted by the two more
  specific and more recent documents. **The sentence-case decision recorded on 2026-09-10 is
  reversed.**
- **§3.5 (header casing) survives but inverts.** Uppercase table headers are *specified*. `DataTable`
  carries `uppercase` and renders sentence case anyway — so the defect is that the specified
  treatment is not rendering, and the fix is to make it render, not to remove it. The ad hoc table in
  `assessment-list.tsx` is the one currently doing it correctly, at the wrong weight (700).

**What survives unchanged:** §3.1 (record links styled seven ways, five hover-only), §3.2 (two list
layouts for the same record type), §3.3 (Risk Register identifier scrolls away), §3.6 (anchor as
disabled control), §3.7 (feature components bypass the shared state primitives), and everything in §4.
These were measured against behaviour and cross-surface comparison, not against the type contract, so
the wrong baseline did not touch them.

**Root cause of the error:** the review derived its baseline from the phase UI-SPECs without checking
whether a design system document existed. `globals.css` names it in the second line of the file.

---

## 1. Scores

| Phase | Copy | Visuals | Color | Type | Spacing | Experience | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 Foundation & shell | 2 | 2 | 3 | 1 | 2 | 2 | **12** |
| 02 Request workflow | 3 | 3 | 3 | 2 | 2 | 3 | **16** |
| 03 Dynamic questionnaire | 3 | 3 | 4 | 2 | 2 | 4 | **18** |
| 04 Assessment review & release | 3 | 3 | 4 | 3 | 4 | 4 | **21** |
| 05 Risk register | 4 | 3 | 4 | 3 | 4 | 4 | **22** |
| 06 Administration & CSV | 3 | 2 | 4 | 2 | 3 | 3 | **17** |
| 06.1 Revert to draft | 3 | 3 | 2 | 2 | 4 | 3 | **17** |
| 06.2 AI questionnaire | 3 | 2 | 3 | 2 | 3 | 2 | **15** |
| 06.3 Search & selection | 2 | 2 | 3 | 2 | 2 | 2 | **13** |
| 06.4 Cross-record navigation | 2 | 3 | 2 | 2 | 4 | 3 | **16** |
| **Mean** | **2.8** | **2.6** | **3.2** | **2.1** | **3.0** | **3.0** | **16.7** |

Typography is the weakest pillar in the product (2.1/4) and was scored low by all ten auditors
independently. Color is the strongest (3.2/4) and the browser pass confirms it.

---

## 2. The root cause the per-phase audits could not see

Every phase audit reported the same class of defect — `font-medium`, `text-xs`, `text-lg` drifting
from the contracted ramp — and each attributed it to its own feature code. Read together, and
verified at runtime, that reading is wrong.

**The contract** (`01-UI-SPEC.md:78-85`) is four size+weight *pairs*, not four sizes and two weights:

| Role | Contract |
|---|---|
| Body | 16px / 400 |
| Label | 14px / 600 |
| Heading | 20px / 600 |
| Display | 28px / 600 |

**What the design system itself ships.** `apps/web/app/globals.css` declares font sizes
`11, 12, 13, 14, 16, 24px` and weights `500, 600`. Of these, only `14px` and `16px` appear in the
contract at all, and `--text-table-size: 13px` / `--text-micro-size: 11px` are first-class tokens for
sizes the contract never defines. Weight `500` — the weight ten auditors flagged as feature drift —
is declared in the global stylesheet, not introduced by features.

**Measured in the browser** (Risk Register, 1440px): **0 of 179** rendered text elements match any
contracted pair. Eleven distinct combinations render, none of them contracted:

```
14/400 x53   12/500 x30   11/500 x26   13/400 x20   13/500 x18   14/500 x18
12/400 x8    24/600 x3    16/600 x1    12/600 x1    11/400 x1
```

The dominant body text is `14px/400` — a size the contract reserves for 600-weight labels, at a
weight it reserves for 16px body. Across every other route the off-contract share is 67–95%.

> **Implication for remediation.** Fixing this phase by phase — the shape all ten reviews imply —
> will not converge, because the tokens each phase is being asked to conform *to* are themselves
> off-contract. The fix belongs in `globals.css` and the shared primitives first; only then is
> per-phase cleanup meaningful. This reordering is the main practical output of the roll-up.

### The same pattern in the all-caps rule

`01-UI-SPEC.md:78` states: *"do not use all-caps text for labels or navigation."* Three independent
mechanisms produce all-caps labels anyway:

1. `.micro-label` in `globals.css:253-259` — 11px/500/uppercase (4 component files)
2. Tailwind `text-xs uppercase tracking-wide` — assessments (5 files), requests
3. `data-table.tsx:117,289` — `text-[length:var(--text-micro-size)] uppercase`

**Contract conflict, not purely an implementation defect:** `06-UI-SPEC.md:80` explicitly sanctions
DataTable's *"uppercase micro-header typography tokens unchanged."* Phase 01 forbids what Phase 06
blesses. Several per-phase audits scored this as a violation without noticing the two specs
disagree. **This needs a spec decision before any code changes.**

---

## 3. Runtime findings — defects invisible to static analysis

### 3.1 Record links are styled seven ways across seven surfaces — BLOCKER

`01-UI-SPEC.md:98` reserves the accent token for *"inline links only."* Measured computed styles:

| Surface | Colour | Underline at rest | Size/Weight |
|---|---|---|---|
| `/app/assessments` | `#155eef` accent | yes | 12/500 |
| `/app/review/assessments` | `#155eef` accent | yes | 14/500 |
| `/app/requests` | `#101828` foreground | **no** | 13/500 |
| `/app/risks` | `#101828` foreground | **no** | 13/400 *and* 13/500 |
| `/app/review/requests` | `#101828` foreground | **no** | 14/500 |
| `/app/review/questionnaires` | `#101828` foreground | **no** | 16/600 |
| `/app/admin/controls` | `#101828` foreground | **no** | 13/500 |

Only 2 of 7 surfaces give record links a persistent affordance. The other five carry
`hover:underline` — so the affordance exists but is **hover-only**, invisible at rest and unavailable
on touch. `/app/risks` is the worst case: one record link renders at weight 400, identical to its
siblings, so at rest nothing distinguishes it from body text. `/app/risks` also uses two different
weights for record links *on the same table*.

This extends 06.4's finding #1 (which flagged detail-page backlinks) to list surfaces, and directly
contradicts `06.4-VERIFICATION.md`'s claim that browser verification found all criteria met — that
check passed because each surface renders correctly *in isolation*; the defect only exists in
comparison.

### 3.2 Two incompatible list layouts for the same record type — BLOCKER

At 1440px, six comparable list surfaces split into two layout languages:

- **Table:** `/app/requests`, `/app/review/assessments`, `/app/risks`
- **Cards:** `/app/questionnaires`, `/app/assessments`, `/app/review/questionnaires`

The same assessment (`ASM-2026-33SAEN`) renders as a narrow card using roughly a third of the
viewport on `/app/assessments`, and as a full-width table row on `/app/review/assessments` — same
record, same role, same session, adjacent nav items, identical search/filter/pagination furniture.
This confirms 06.3 fix #2 and scopes it precisely.

At 375px all six correctly collapse to cards.

### 3.3 Risk Register loses row identity on horizontal scroll — WARNING

`01-UI-SPEC.md:58` permits *"a deliberate, labelled table scroll container"*, so the scroll itself is
conformant. The defect is what happens during it:

- 8 columns, 1758px content in a 1119px container → **639px (36%) hidden** at 1440px
- First column (`Risk number`) is `position: static`, not sticky
- Scrolled fully right, the identifier sits at `left: -350px` — entirely off-screen

A user reading *Treatment owner* or *Target date* cannot tell which risk the row belongs to, on a
register whose purpose is per-risk treatment tracking. Only `/app/risks` overflows; `/app/requests`,
`/app/review/assessments`, `/app/admin/controls` and `/app/admin/information-systems` all fit at
1440px. *Not verified:* whether the container satisfies the spec's "labelled" requirement.

### 3.4 Sidebar navigation rows miss the touch-target floor — WARNING

`01-UI-SPEC.md:109` requires sidebar rows to be *"40px visually but retain a 44px interactive target
through padding."* Measured: `232 x 36px`. Below both figures. 17–54 sub-44px controls per route at
desktop, dropping to 3–11 at 375px where the sidebar collapses into a sheet — so this is a
desktop-specific violation. Confirms Phase 01's static finding with numbers.

### 3.5 Table header casing differs between surfaces — WARNING

`/app/review/assessments` renders headers uppercase (`ASSESSMENT`, `SUMMARY`, `STATUS`); `/app/risks`,
`/app/requests` and `/app/admin/*` use sentence case (`Risk number`, `Request ID`, `Control number`).
Same component family, two conventions. Ties into the §2 spec conflict.

### 3.6 Disabled pagination uses anchors — WARNING

`/app/review/questionnaires` renders `<a href="#" aria-disabled="true">` for Previous/Next.
`aria-disabled` does not prevent activation on an anchor: keyboard and pointer users can still
activate it, navigating to `#`. Should be `<button disabled>` or omitted.

### 3.7 Feature components bypass the shared state primitives — WARNING

`EmptyState`, `ErrorState`, `PermissionDeniedState` and `LoadingState` exist in
`src/components/states/states.tsx` and are imported by 17 route-level files — but by **zero** files
under `src/features/`. Every feature hand-rolls its own state blocks, which is the mechanism behind
the copy drift that phases 02, 03 and 06.3 each reported separately.

> **Correction to the Phase 03 review:** it states no such primitives exist anywhere in the codebase.
> They do. The defect is divergence, not absence — the remediation differs accordingly.

---

## 4. What the browser pass cleared

These were checked at runtime and are **not** defects. Recorded so they are not re-litigated:

- **Colour contrast — clean.** Zero WCAG AA failures across all 8 routes audited. Sidebar nav is
  white on `#102A43` at **14.6:1**; the muted "Administration" group label at **7.9:1**. An earlier
  automated sweep reported four failures; all four were artifacts of the audit script failing to
  composite alpha and were discarded.
- **Keyboard focus visibility — clean.** Real Tab traversal paints `2px solid #155eef` with a white
  offset ring and correct `:focus-visible` matching. An earlier programmatic `.focus()` sweep
  reported "no ring" on every control; Chrome does not honour `focus({focusVisible:true})`, so that
  result was inconclusive and was discarded.
- **No horizontal page overflow** at 375px on any of 8 routes — validates 06.4's overflow work.
- **Heading order** — no skipped levels on any route audited; one `h1` per page.
- **No unnamed interactive controls** on any route.
- **No console errors or hydration warnings** on any route.
- **Light-only rendering is correct.** `01-UI-SPEC.md:97` states the dark sidebar is *"a deliberate
  BProton-led anchor, not dark mode"* and the shell is light-first. Under
  `prefers-color-scheme: dark` the app correctly stays light. *Minor hardening:* `color-scheme` is
  never declared (`normal` at `:root`, no meta tag), so UA-painted chrome — scrollbars, select
  popups, autofill — follows the OS while the app does not. Declaring `color-scheme: light` closes
  this.

---

## 5. Recommended order of work

1. **Resolve the all-caps spec conflict** between `01-UI-SPEC.md:78` and `06-UI-SPEC.md:80`. Blocks
   §2 and §3.5; no code should change first.
2. **Reconcile `globals.css` with the type contract** — the 11/12/13/24px sizes and weight 500. This
   is the root cause of the lowest-scoring pillar and gates any per-phase typography cleanup.
3. **Standardise the record-link treatment** (§3.1) on the accent token with a persistent underline.
   Highest user-visible impact; five of seven surfaces currently have no at-rest affordance.
4. **Pick one list layout per record type** (§3.2) and apply it to all six list surfaces.
5. **Restore 44px sidebar targets** (§3.4) and make the Risk Register identifier column sticky (§3.3).
6. **Route feature components through the shared state primitives** (§3.7), retiring hand-rolled
   blocks and their drifted copy.
7. Then per-phase fixes from the individual `{phase}-UI-REVIEW.md` files.

---

## 6. Per-phase reports

| Phase | Report |
|---|---|
| 01 | `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-REVIEW.md` |
| 02 | `.planning/phases/02-requestor-risk-assessment-request-workflow/02-UI-REVIEW.md` |
| 03 | `.planning/phases/03-dynamic-questionnaire-workflow/03-UI-REVIEW.md` |
| 04 | `.planning/phases/04-assessment-review-risk-editing-and-release/04-UI-REVIEW.md` |
| 05 | `.planning/phases/05-risk-register-and-mitigation-management/05-UI-REVIEW.md` |
| 06 | `.planning/phases/06-administration-and-csv-imports/06-UI-REVIEW.md` |
| 06.1 | `.planning/phases/06.1-requestor-and-analyst-revert-to-draft-for-requests-and-quest/06.1-UI-REVIEW.md` |
| 06.2 | `.planning/phases/06.2-ai-generated-contextualised-questionnaire/06.2-UI-REVIEW.md` |
| 06.3 | `.planning/phases/06.3-correctness-search-and-selection/06.3-UI-REVIEW.md` (re-audited, overwritten) |
| 06.4 | `.planning/phases/06.4-cross-record-navigation-and-interface-consistency/06.4-UI-REVIEW.md` |

Two per-phase findings are amended by the runtime evidence above: Phase 03's "no state primitives
exist" (§3.7) and Phase 06.4's recommendation to conform new tables to `--text-table-size` (13px),
which would propagate an off-contract token (§2).
