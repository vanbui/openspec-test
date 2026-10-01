---
phase: "22"
slug: "admin-role-and-configurable-lists"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 22 — UI Design Contract

> Visual and interaction contract for the Admin role and configurable lists (ADMIN-07, ADMIN-08; closes UAT-061; carries UAT-053's asset owner and G-20's manual start). It covers:
> - the Admin's navigation, Home and the permission state on every Admin and analyst URL (D-24; SC4);
> - reference data for the Admin (manage, import, retire Risk Types, the Information Asset owner) and read-only for Security Analysts (D-06, D-18, D-21; SC1);
> - the configuration index and five setting pages with one before-and-after confirmation, applied forward (D-10 to D-17; SC2);
> - the divisions and business units list and the request form that uses it (D-19); shared-view governance (D-20);
> - the read-only, exportable role holders view and the change log (D-07, D-08, D-12; SC3);
> - the manual start when AI generation is refused or unavailable (G-20; D-22, D-23).
>
> It adds no colour, type size, weight, family, radius, shadow, duration or width. Seven patterns are proposed as CSRM extensions X-74 to X-80. Refusal copy is family AA.

---

## Binding inputs and value authority

- **Locked decisions:** D-01 to D-28 in `22-CONTEXT.md`. No RESEARCH exists yet. Routes, capability names, reason codes and bounds are proposals within CONTEXT D-03 and D-24; research and the planner fix them (Planner's Discretion). Bounds in copy are written `{max}` where research fixes them.
- **Value authority:** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). Nothing here restates a value.
- **Extensions reused:** X-2 (record picker), X-3 (dates), X-4 (separators), X-5 (in-place edit form), X-6 (sidebar sections), X-9 (segmented control), X-10 (figure links), X-11 (AI provenance, amended by X-80), X-13 (side sheet; block links are §4 Record links' 2026-09-24 extension), X-14 (Undo toast), X-24 (before-and-after comparison anatomy), X-27 (withdrawn pattern, amended by X-77), X-29 (record history), X-30 (export), X-40 (person picker), X-46 (decision rounds), X-50 (comparison moments), X-54 (unsaved changes bar), X-56 (edit conflicts), X-57 (matrix picker cell anatomy), X-59 (saved views), X-65 (usage, plain for the Admin).
- **Earlier contracts, cited by section and never restated:**
  - **Phase 10:** §6.3 (leave warning), §10.2 (refusal format and kinds), §11.1 and §11.2 (the gate and permission descriptions), §12.1, §12.2 and §12.4 (generation cards), §14 (readiness anatomy), §16.4 (owner column pattern).
  - **Phase 11:** "Voice, formats and shared copy rules"; §1.1 to §1.3 (profiles, anatomy); §5.1, §5.2 and §5.4 (Home and its states); §7 (lists, density, phone cards); §8.1 (figure link rules); §12 (five-state format).
  - **Phase 12:** §9.3 (Requestor disclosure, unchanged: a manual start is not `aiAssisted`), §11.1 to §11.3 (policy status and refusals, amended in §11 below).
  - **Phase 13:** family K (`OWN_REQUEST`, `REQUEST_UNASSIGNED`, `NOT_ASSIGNED_ANALYST`), the assignment block.
  - **Phase 17.1:** "Voice" authority labels; §2 (readiness in the review and submit panel).
  - **Phase 18:** §4.1 and §4.3 (matrix picker, ratings, `Not on the scale`), §5.2 (views and the view dialog).
  - **Phase 19:** §1 and §2 (Export action and dialog), §3.1 (flag values), §5 (import flow), family S.
  - **Phase 20:** §6.2 (register filters), §11.1 (Used in), §11.2 (suggestions, replaced on the request form by §7.3 below).

### Decision coverage

| Decisions | Where |
|---|---|
| D-05, D-24 | §1 (navigation, routes, capabilities), §2 (permission states), §3 (Home) |
| D-06, D-18, D-21 | §4 (reference data) |
| D-10, D-12 (per page), D-25 | §5, §6 (configuration and the change confirmation) |
| D-11 | §6.7 (forward effect in readiness and rounds) |
| D-13 to D-17 | §6.2 to §6.6 |
| D-19 | §7 |
| D-20 | §8 |
| D-07, D-08, D-09 | §9 (role holders, review notes) |
| D-12 | §10 (change log), X-29 history on records and settings |
| D-22, D-23 | §11 (manual start) |
| D-03 item 9 | §12 (family AA) |
| D-25, D-27 | §13 (five states, G-4), §14 (test assertions) |

---

## Design System

| Property | Value |
|---|---|
| Tool | shadcn (source-owned, unchanged) |
| Preset | new-york / neutral / CSS variables / lucide |
| Component library | radix (`radix-ui`) |
| Icon library | `lucide-react` 1.30.0 |
| Font | §3.10 families, unchanged |

Every icon named here was confirmed in the installed `lucide-react` 1.30.0 on 2026-10-01 (`node -e` over its exports in `apps/csrm`): `Settings2`, `ListTree`, `Share2`, `UserCog`, `ScrollText`, `Layers`, `SlidersHorizontal`, `Server`, `Database`, `Archive`, `ArchiveRestore`, `ArrowUp`, `ArrowDown`, `Plus`, `PenLine`, `History`, `Download`, `Upload`, `ShieldBan`, `UserX`, `ArrowLeftRight`, `CircleSlash`, `Landmark`, `Scale`, `CalendarRange`, `ChevronRight`, `Check`, `Info`, `TriangleAlert`, `Bot`, `Link2`, `Link2Off`.

**New dependencies:** none.

---

## Component Inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

Non-exhaustive: known-good components this phase uses, never a closed allowlist.

| Component | Phase 22 use |
|---|---|
| `Dialog`, `AlertDialog` (through `ConfirmDialog`) | Change confirmation, view rename and transfer, manual start |
| `Sheet` | Change details (X-13), history (X-29), phone confirmation and filters |
| `Command`, `Popover` | Person picker (X-40) for the asset owner and view transfer |
| `Input`, `Textarea`, `Select`, `RadioGroup`, `Switch`, `Label` | Setting fields, list entries, request form selects |
| `Alert` | Conflict, invalid summary, source and read-only notices |
| `Table`, `Pagination`, `Skeleton`, `Badge`, `Button`, `Separator`, `Card`, `Tooltip` | Lists, cards, states |
| `sonner` `Toaster` | Undo and outcome toasts (X-14) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

Non-exhaustive.

| Primitive | Phase 22 use |
|---|---|
| `DataTable`, `HorizontalScrollRegion` | Role holders, change log, shared views, reference lists |
| `StatusBadge` (`statusPresentation`), `RiskRatingBadge` | `Retired`, band badges, every state value |
| `SegmentedControl` | `Show` (active and retired) |
| `PageHeader`, `RecordLink`, `DetailSection`, `FormSection`, `ConfirmDialog`, `NativeSelect` | Pages, links, sections, forms, confirmations |
| Earlier phases' planned modules: 10's leave guard and refusal copy; 16's history sheet; 17's person picker; 18's unsaved changes bar, conflict alert and view dialog; 19's export dialog and import flow; 20's usage panel | as those phases plan them |
| **New** (recommended): `features/configuration/` (index, `setting-page.tsx`, `change-confirmation.tsx`, `band-preview-matrix.tsx`, one editor per key, `configuration-domain.ts` zod-free), `features/lists/` (`list-editor.tsx`, `list-entry.tsx`), `features/access-review/` (`role-holders.tsx`, `review-notes.tsx`, `change-log.tsx`, `change-entry.tsx`, `change-details-sheet.tsx`), `features/shared-views/`, `features/generation/manual-start.tsx` | Planner's choice |

---

## Voice, formats and shared copy rules

Phase 11's rules apply unchanged. In addition:

- **Terms (D-25):** `Admin`, `Reference data`, `Configuration`, `Retire`, `Reinstate`, `Retired`, `Not on the list`, `Start without AI`, `Role holders`, `Change log`, `Review notes`, `Shared views`, `Divisions and business units`. Never `Delete`, `Remove` or `Disable` for a list entry or Risk Type; never `Assign role`, `Grant` or `Revoke` anywhere in CSRM (no route exists, 08 D-36).
- **Setting names (one source, used in titles, toasts and the change log):** `Scale and rating bands`, `Risk appetite`, `Peer review`, `AI data policy`, `Records retention`.
- **Authority labels:** 17.1's three, unchanged. **Classifications:** `Public`, `Internal`, `Restricted`, `Critical Infrastructure Sensitive`. **Impact areas:** `Financial`, `Operational`, `Regulatory and legal`, `Reputational`, `Privacy`, `Safety`.
- **Derived facts come from the server** (D-10, 17.1 D-58): authority, approver needed, peer approval needed, the policy outcome and readiness. The only web computation is the illustrative band preview while editing (UI-D6).
- **Before and after:** comparisons name their columns `Now` and `After this change` (X-74); the change log names them `Before` and `After` (X-78). Never an arrow character in copy.
- **Counts:** `tabular-nums` and written plurals.

---

## 1. Navigation, routes and capabilities (D-05, D-24)

### 1.1 Profiles (11 §1.1, X-6)

The Admin profile is the Requestor profile (11 §1.1) plus two sections after `My work`. A person holding Security Analyst and Admin gets the analyst profile plus the `Administration` section; `Reference data` renders once. The development role switcher (11 §1.2 footer) gains `Admin`.

| # | Section | Label | Opens | Capability (proposed) | Icon |
|---|---|---|---|---|---|
| 1 | `Reference data` | `Risk Types` | `/app/admin/risk-types` | `reference-data:read` | `Layers` |
| 2 | `Reference data` | `Controls` | `/app/admin/controls` | `reference-data:read` | `SlidersHorizontal` |
| 3 | `Reference data` | `Information Systems` | `/app/admin/information-systems` | `reference-data:read` | `Server` |
| 4 | `Reference data` | `Information Assets` | `/app/admin/information-assets` | `reference-data:read` | `Database` |
| 5 | `Administration` | `Configuration` | `/app/admin/configuration` | `configuration:manage` | `Settings2` |
| 6 | `Administration` | `Divisions and units` | `/app/admin/divisions` | `configuration:manage` | `ListTree` |
| 7 | `Administration` | `Shared views` | `/app/admin/shared-views` | `configuration:manage` | `Share2` |
| 8 | `Administration` | `Role holders` | `/app/admin/role-holders` | `access-review:read` | `UserCog` |
| 9 | `Administration` | `Change log` | `/app/admin/change-log` | `access-review:read` | `ScrollText` |

The analyst's `Reference data` section (11 §1.1 rows 8 to 11) moves from `administration:manage` to `reference-data:read`. `reference-data:manage` gates the write controls and the new, import and edit routes. No counts on these items.

### 1.2 Routes and titles

Static segments under `/app/admin/`, which take precedence over `[collection]`. Route titles are `{h1} | IdamBox CSRM`.

| Route | h1 | Description |
|---|---|---|
| `/app/admin/configuration` | `Configuration` | `The risk criteria, review rules and data policies CSRM applies. Each change applies from now on and is kept in the change log.` |
| `/app/admin/configuration/risk-scale` | `Scale and rating bands` | `How likelihood and consequence are described, and which scores fall in each rating band.` |
| `/app/admin/configuration/risk-appetite` | `Risk appetite` | `Who may accept a risk at each residual rating, whether treatment is expected, and how often the decision is reviewed.` |
| `/app/admin/configuration/review-policy` | `Peer review` | `When a second Security Analyst approves an assessment before it’s submitted for decisions.` |
| `/app/admin/configuration/ai-data-policy` | `AI data policy` | `The highest information classification the AI provider is approved for, and how unclassified requests are treated.` |
| `/app/admin/configuration/record-retention` | `Records retention` | `How long assessment records and their files are kept after a request closes.` |
| `/app/admin/divisions` | `Divisions and business units` | `The divisions and business units people choose from when they raise a request.` |
| `/app/admin/shared-views` | `Shared views` | `Risk register views Security Analysts share with each other. Rename, stop sharing or hand one to a new owner.` |
| `/app/admin/role-holders` | `Role holders` | `Who holds each CSRM role, from the identity records. Roles are assigned in the identity platform, not in CSRM.` |
| `/app/admin/change-log` | `Change log` | `Every change to configuration, lists, reference data, shared views and roles: who made it, when, and the values before and after.` |

Settings pages render on the server with small, zod-free client forms loaded with `next/dynamic` (R-08-34).

---

## 2. Permission states (SC4; D-24)

10 §11.1's gate: the capability check runs before any read, metadata keeps the static title, the page shows no data and no Admin action, and the same state renders for any id. Every state uses the shared permission primitive with an outline link action.

| Who, where | Alert title | Description | Action |
|---|---|---|---|
| Anyone without `configuration:manage` at a configuration, divisions or shared-views route | `You don’t have permission to change configuration` | `CSRM’s configuration is maintained by the Admin.` | `Go to Home` → `/app` |
| Anyone without `access-review:read` at role holders or the change log | `You don’t have permission to view the access review` | `Role holders and the change log are for the Admin.` | `Go to Home` |
| A Security Analyst at `/app/admin/{collection}/new`, `/import` or `/{id}/edit` | `You don’t have permission to change {plural}` | `{plural} are maintained by the Admin. You can read and export them.` | `Back to {plural}` |
| A first-line person at a reference list or detail | `You don’t have permission to view reference data` | `Reference data is for Security Analysts and the Admin. Your workspace shows the work you can open.` (replaces 10 §11.2's Administration row) | `Go to Home` |
| The Admin at any analyst route | 10 §11.1's titles | 10 §11.1's Requestor descriptions and actions (the Admin holds the Requestor birthright) | as 10 §11.1 |
| The Admin at another person's request, questionnaire or assessment | The in-shell not-found page, as any Requestor | — | — |

---

## 3. The Admin's Home (D-24; 11 §5)

The Admin lands on the Requestor Home (11 §5.2) with one section added after `Needs your action`, in 11 §5.2's section anatomy:

- h2 `Administration` (`Settings2`), description `Configuration, access review and recent changes.`
- Three link rows (X-10; block links with `ChevronRight`):
  - `{n} review {note|notes}` · caption `Role holders to check in the access review.` → `/app/admin/role-holders?notes=any` (total equals the filtered table); `No review notes` as plain text when 0, linking the row header `Role holders` instead.
  - `Last change {instant} by {name}` · caption `{area}: {subject}` → `/app/admin/change-log`; `No changes recorded yet` when empty.
  - `Configuration` · caption `Scale, appetite, peer review, AI data policy and retention.` → `/app/admin/configuration`.
- Reads only when the viewer holds `access-review:read`; loading and error follow 11 §5.4 (`We couldn’t load the administration summary` · `Try again`), failing the section alone.

---

## 4. Reference data (D-06, D-18, D-21; SC1)

### 4.1 Who sees what

| Surface | Admin (`reference-data:manage`) | Security Analyst (`reference-data:read`) |
|---|---|---|
| List header actions | `Create {singular}` (primary), `Import`, `Export` (19 §1) | `Export` only |
| List description | Unchanged | Unchanged, plus ` Maintained by the Admin. You can read and export it.` |
| Detail header | `Edit {singular}`, `History` (X-29), Risk Types add `Retire Risk Type` or `Reinstate Risk Type` (outline) | `History` (X-29) only |
| Usage (X-65) | Plain counts, no links; `Used in` rows plain with caption `Security Analysts open these lists.` | 20 §11.1 unchanged (links) |
| Search, filters, density, phone cards | Unchanged | Unchanged |

Controls a viewer may not use are not drawn. The import flow (19 §5) is the Admin's only.

### 4.2 Risk Types: retire and reinstate (D-18; X-77)

- The list gains the `Show` segmented control `Active ({n})` and `Retired ({n})`, kept in the address (`?show=retired`), for both roles.
- **Admin:** each row ends with a ghost small pill `Retire` (accessible name `Retire {name}`); retired rows show the `Retired` badge and `Reinstate` (outline small, `ArchiveRestore`). Each applies at once, moves the row between the lists, moves focus to the next row and confirms with an Undo toast (X-14):
  - `Retired “{name}”. It’s no longer offered for new risks.` · Undo → `Reinstated “{name}”.`
  - `Reinstated “{name}”. It’s offered for new risks again.` · Undo → `Retired “{name}”.`
- **Elsewhere:** retired types are not offered in the risk editor, the table's cell editor, bulk edits or imports; a risk that has one reads `{name} (retired)`; register and report filters list retired types after active ones with the same suffix.
- **Import and export:** the Risk Type file gains the `Active` column with 19 §3.1's flag values; the import's row issue for a risk naming a retired type is family AA's `RISK_TYPE_RETIRED`.

### 4.3 Information Asset owner (D-21; 10 §16.4's pattern)

| Surface | Contract |
|---|---|
| Form | `Owner` (optional), a person picker (X-40) with hint `The person accountable for this asset.` and 10 §16.4's `Selected owner: {name}` seeding |
| Assets list | Columns `Name`, `Owner`, `Classification`, then today's; an empty owner reads `Not provided`; an inactive owner reads `{name} (inactive)` |
| Phone card | Adds `Owner: {name} · Classification: {value}` with the same fallbacks |
| Detail and analyst views of an asset | `Owner` in the definition list; participant projections keep only the asset name (17 D-25) |
| Export | `Owner` column after `Name` (display name) |

---

## 5. The configuration index (D-24)

A grid of block-link cards (§4 Cards; block links with `ChevronRight`), two columns from 1024px and one below, in this order: the five settings, then `Active Risk Types` (→ `/app/admin/risk-types?show=retired`) and `Divisions and business units` (→ `/app/admin/divisions`).

Each setting card: h2 the setting name in `--text-heading-sm`; one `--text-body` / `--color-text-secondary` sentence (the §1.2 description); a served summary in `--text-body` (for example `High: risk owner with executive approval · review within 6 months`); and a `--text-caption` line `Changed {instant} by {name}` or `Default values, never changed`. The AI data policy card adds its source line (§6.5). Phones: one column, full width.

Loading: seven card skeletons in the final grid. Error: `We couldn’t load the configuration` · `Try again`.

---

## 6. Setting pages (D-10 to D-17, D-25; X-74)

### 6.1 Shared anatomy (X-74)

| Part | Contract |
|---|---|
| Header | h1 and description (§1.2); meta line `Changed {instant} by {name}` or `Default values, never changed`; actions `Edit {short name}` (primary: `Edit scale`, `Edit appetite`, `Edit peer review`, `Edit AI policy`, `Edit retention`) and `History` (outline, X-29 over this key's change rows) |
| Read mode | The current values as definition lists or tables (per page below) |
| Edit mode | The same layout with fields in place (§4 Forms); focus moves to the first field. X-54's bar slides up from the first change: `{n} unsaved {change|changes}`, `Discard changes` (ghost; Undo toast), `Review changes` (primary). Phase 10 §6.3's leave warning guards the page |
| Validation | On blur (§4 Forms), from the zod-free domain module; the server's parser is authoritative (`CONFIGURATION_INVALID`, family AA) |
| Change confirmation | Dialog at the complex size (§4 Dialogs), full-screen sheet below 768px. Title `Apply this change to {setting name}?`. In order: the comparison (X-24's table anatomy; columns `Now` and `After this change`; only changed fields, unchanged fields collapsed as X-50); the forward effect (§6.2 to §6.6, `--text-body`); `Reason for this change` (textarea, required, 1 to 500 characters, hint `Say who decided it, such as a committee minute. It’s kept in the change log.`); actions `Apply change` (primary) and `Keep editing` (ghost). `Ctrl`/`⌘` `Enter` in the reason applies. Esc keeps editing |
| Apply | Waits for the server (governance step, §5 Optimistic UI): inline 16px spinner in `Apply change`. Success: the page returns to read mode, focus moves to the h1, success toast `{setting name} updated.` (no Undo; another change reverses it) |
| Stale version (`CONFIGURATION_CHANGED`) | The dialog closes and edits stay. X-56's single-record form: a warning alert `{setting name} changed while you were editing` · `{name} changed it at {instant}. Your edits are kept.` with `Keep all mine` and `Take all theirs`; each conflicting field shows X-56's line and pills. `Review changes` then compares against the newer values |
| Invalid (`CONFIGURATION_INVALID`) | The dialog closes; a danger alert `{k} {value needs|values need} fixing` lists each served problem as a link to its field; each field shows its error; the reason is kept |
| Recent changes | After the values, h2 `Recent changes`: up to five X-78 entries, then `Open in the change log` (record link → `/app/admin/change-log?area=configuration&subject={key}`). Empty: `No changes yet` · `These are CSRM’s default values.` |
| Phones | Tables become one card per row (§6.2, §6.3); the bar and dialog follow X-54 and §4 Dialogs' phone form |

### 6.2 Scale and rating bands (D-13; X-75)

**Read mode, in order:**
1. h2 `Rating bands`: a table `Band` (`RiskRatingBadge`) · `Scores` (`1 to 4`, `5 to 9`, `10 to 16`, `20 to 25`), then the band preview matrix (X-75).
2. h2 `Likelihood`: a table `Level` (`{label} ({score})`) · `Description`, five rows, highest first.
3. h2 `Consequence`, then one h3 per impact area (six), each a table `Level` · `Description`, five rows.

**Edit mode:**
- Band boundaries: three selects (`NativeSelect`) `Low: highest score`, `Moderate: highest score`, `High: highest score`, each offering the 5 × 5 products; a read-only line `Critical: scores above {n}`. On-blur errors: `Choose a score above the Low band’s highest.` · `Choose a score above the Moderate band’s highest.` · `Leave at least one score for Critical.` The preview matrix updates with the label `Preview` above it.
- Descriptions: each becomes a textarea (two rows, grows), required, up to `{max}` characters; labels `{level} ({score})` with the area in the h3. Errors: `Describe this level.` · `Keep this to {max} characters or fewer.`
- Fixed in this phase (stated once under the h1 in edit mode, `--text-caption`): `Level and band names, scores and impact areas are fixed. Stored ratings and imports depend on them.`

**Comparison rows:** each changed boundary (`Low: highest score` · `4` · `5`), then `Scores that change band` (`Score 5` · `Moderate` badge · `Low` badge), then each changed description (`Likelihood: Rare (1)` or `Financial: Minor (2)`).

**Forward effect:** `This applies from now on. Ratings already recorded keep their values, released risks keep theirs, and an open acceptance round keeps the bands it opened with. Unreleased assessments list any rating outside the new bands to fix before submission.`

**Reach:** 18 §4.1's picker, 18 §4.3's ratings, 19 §3.4's template notes and the heat map read the served scale; no copy changes there.

### 6.3 Risk appetite (D-14)

**Read mode:** from 768px a table, one row per band, Low first: `Residual rating` (badge) · `Who decides` (17.1's authority label) · `Treatment expected` (`Yes` or `No`) · `Review within` (`{m} months`). Under it, `--text-caption`: `The AI may propose Accept only for Low or Moderate residual risk, and only where the risk owner decides alone with no treatment expected.`

**Edit mode:** in each row, `Who decides` a `Select` of the three authorities; `Treatment expected` a `Switch` named `Treatment expected for {band}`; `Review within` a number input with the suffix `months` (whole months, `{min}` to `{max}`). On-blur errors, served wording where the server supplies it:
- `{band} can’t need a weaker authority than {lower band}.`
- `Treatment is expected for {lower band}, so it must be expected for {band} too.`
- `{band} can’t be reviewed less often than {lower band}.`
- `Enter whole months from {min} to {max}.`

**Phones:** one card per band: the badge as title, then the three fields stacked.

**Comparison rows:** `{band}: who decides`, `{band}: treatment expected`, `{band}: review within`.

**Forward effect:** `This applies from each assessment’s next submission. Open acceptance rounds and recorded decisions keep their authority and review dates. Decision reviews use the appetite current when they happen.`

### 6.4 Peer review (D-15)

**Read mode:** `Peer approval is needed for` and the current choice in `--text-body` at 500.

**Edit mode:** a radio group (labels too long for a segmented control, §4 Forms) named `Peer approval is needed for`: `Any Critical residual risk` (default), `Any High or Critical residual risk`, `Every assessment`, `Never`. Choosing `Never` shows, under the group, a warning alert `Submissions will need no second Security Analyst.`

**Forward effect:** `This applies to assessments not yet submitted and to each assessment at its next submission. An open acceptance round keeps the rule it opened with.` For `Never`, the warning alert repeats above the reason.

### 6.5 AI data policy (D-16)

**Source line** (an info `Alert`, `Info`, under the header, served state):

| Source | Title | Description |
|---|---|---|
| Recorded by the Admin | `Set here` | `Changed {instant} by {name}. The deployment setting is ignored.` |
| Deployment bootstrap, value set | `Using the deployment setting` | `The ceiling comes from the deployment until you record one here. Recording one replaces it.` |
| Nothing set, development | `No ceiling in development` | `Nothing is refused in development until a ceiling is set.` |
| Nothing set, elsewhere | warning `Alert`, `ShieldBan`: `No ceiling set` | `AI generation is refused for every request until you set one.` |

**Read mode:** `Approved ceiling` and `Unclassified requests are treated as` as a definition list.

**Edit mode:** two radio groups: `Approved ceiling` (the four classifications, hint `The highest classification the AI provider is approved to receive.`) and `Unclassified requests are treated as` (`Internal`, `Restricted`, `Critical Infrastructure Sensitive`; hint `For requests with no classified information asset. Never Public.`).

**Forward effect:** `This applies to the next generation, and to any queued generation when it runs, so a lower ceiling refuses queued generations above it. Records already generated don’t change.`

### 6.6 Records retention (D-17)

**Read mode:** `Keep records for {n} years after the request closes.`

**Edit mode:** `Years to keep records` (number input, whole years `{min}` to `{max}`, suffix `years`), hint `Assessment records and their files.` Error: `Enter whole years from {min} to {max}.`

A `--text-caption` line in both modes: `CSRM records this rule and shows it with request files. It doesn’t delete anything itself: your operator sets the file storage to keep files this long.`

**Forward effect:** `The files section shows the new period from now on. Tell your operator so the file storage matches it.`

The files section's retention line (Phase 14's files copy) reads the served value: `Files are kept for {n} years after the request closes.`

### 6.7 Forward effect where people work (D-11)

- **Readiness** (17.1 §2's served items over 10 §14's anatomy): an item raised by a configuration change carries, after its line, `--text-caption` `Follows the current {risk appetite|rating bands|peer review setting}.` New served items:
  - `No executive approver needed` (per risk): `{k} {risk names|risks name} an executive approver the current risk appetite no longer needs.` with `Clear` (outline small, accessible name `Clear the executive approver on {risk number}`), applied with an Undo toast `Cleared the executive approver on {risk number}.`
  - The existing `Executive approver`, `Peer approval` and 18 §4.3's `Ratings follow the scale` items fail as served, with the caption above.
- **Acceptance rounds** (X-46's panel): when the served round criteria differ from the current configuration, one `--text-caption` line: `This round follows the risk criteria as they stood when it opened on {date}. The next submission uses the current criteria.`

---

## 7. Divisions and business units (D-19; X-76, X-77)

### 7.1 The page

- Header actions: `Add division` (primary).
- Under the description, `--text-caption`: `A name in use on requests can’t be renamed, so requests keep what they recorded. Retire it and add the new name instead.`
- `Show` segmented control: `Active ({n})` · `Retired ({n})`, in the address.
- **Active:** one card per division (X-76), in list order. Card header: the division name in `--text-heading-sm`, `Used on {n} {request|requests}` (`--text-caption`, plain), then icon buttons `Move {name} up` (`ArrowUp`) and `Move {name} down` (`ArrowDown`) (absent at the ends), `Rename` (ghost small, only when unused) and `Retire` (ghost small). Inside: its business units as rows with the same parts, then `Add business unit` (outline small, `Plus`).
- **Retired:** retired divisions and retired units grouped under their division's name, each with the `Retired` badge and `Reinstate` (outline small).

### 7.2 Acts

| Act | Contract |
|---|---|
| Add | X-5 in-place form: `Division name` or `Business unit name` (required, up to `{max}` characters, hint `Shown on the request form.`), `Add division` / `Add business unit` (primary small), `Cancel` (ghost small). Saves, focuses the new entry, toast `Added “{name}”.` |
| Rename | X-5 in-place form with `Name`, `Save name`, `Cancel`. Toast `Renamed to “{name}”.` |
| Move | Applies at once (optimistic, §5); focus stays on the moved control; polite announcement `{name} moved to position {p} of {n}.` Failure rolls back with the danger toast `We couldn’t move “{name}”. It’s back where it was.` · `Try again` |
| Retire | At once, Undo toast `Retired “{name}”. It’s no longer offered on requests.`; for a division, `Retired “{name}”. It and its business units are no longer offered on requests.` |
| Reinstate | At once, Undo toast `Reinstated “{name}”.` |

States: first-use `No divisions yet` · `Add the divisions people choose from when they raise a request.` · `Add division`; a division without units shows `No business units yet` (`--text-caption`) above `Add business unit`; retired cleared `No retired entries`.

### 7.3 The request form (replaces 20 §11.2 there)

- `Division`: a `Select` of active divisions in list order, with an empty choice `Not set`.
- `Business unit`: a `Select` of the chosen division's active units; before a division is chosen it is disabled with hint `Choose a division first.` Changing the division clears the unit and announces `Business unit cleared.`
- A recorded value that is retired or off the list stays selected, shown `{value} (retired)` or `{value} (not on the list)`, with hint `No longer offered. It stays unless you choose another.`
- Empty list: hint `No divisions are listed yet. Leave this as Not set.`

### 7.4 Analyst filters (20 §6.2)

The `Division` and `Business unit` checklists offer, in order: active entries, retired entries suffixed ` (retired)`, then a group `Not on the list` of recorded values from 20 D-22's suggestions read.

---

## 8. Shared views (D-20)

- **Table** (DataTable, both densities): `View` · `Owner` (name, then a `--text-caption` note `UserX` `Inactive` or `No longer a Security Analyst` when so) · `Shared` (instant) · `Last changed` (instant) · actions `Rename`, `Stop sharing`, `Transfer` (ghost small; accessible names include the view name). Filter chip `Owner: needs a new owner`.
- **Rename:** 18 §5.2's 480px view dialog without the share switch; `Save view`; Undo toast `Renamed the view to “{name}”.`
- **Stop sharing:** at once; Undo toast `Stopped sharing “{name}”. It’s {owner}’s personal view again.`
- **Transfer:** a 480px dialog `Transfer “{name}”`: `New owner`, a person picker (X-40) of active Security Analysts (others listed `aria-disabled` with `Not an active Security Analyst`), hint `Only an active Security Analyst can own a shared view.`; `Transfer view` (primary), `Cancel`. Undo toast `Transferred “{name}” to {new owner}.`
- No link opens a view: the register is the analysts'.
- **Phones:** one card per view: name, owner line, shared instant, the three acts as outline small pills.
- **States:** first-use `No shared views yet` · `Security Analysts share views from the Risk register. Shared views appear here.` (no action); filtered `No shared views match these filters` · `Clear filters`; error `We couldn’t load shared views` · `Try again`.

---

## 9. Role holders (D-07, D-09; X-79)

**Order:** header (`Export`, 19 §1, title `Export Role holders`); the read-only notice; h2 `Roles`; h2 `People`.

- **Read-only notice** (info `Alert`): `Roles are assigned in the identity platform` · `CSRM shows who holds each role and records every change, but can’t assign or remove one. Every active user also holds the Requestor role.`
- **Roles** (a table; cards below 768px): `Role` · `Description` (served) · `Holders` (figure link, X-10, filtering People to that role; total equals the table). Rows: `Admin`, `Security Analyst`, `Security Analyst Agent`, `Requestor only`.
- **People** (DataTable, both densities, paginated with total): `Name` · `Username` · `Email` · `Status` (`Active` or `Inactive`, text) · `Roles` (neutral tags, §4 Tags; `Requestor only` when none) · `Held since` (`{role}: since {date}` per role, or `{role}: since before {date}` where the assignment predates recording; X-3 dates) · `Identity link` (`Link2` `Linked` or `Link2Off` `Not linked`) · `Review notes` (X-79). Rows open nothing.
- **Filters** (chip row): `Role` (`Any explicit role` by default, `Admin`, `Security Analyst`, `Security Analyst Agent`, `Requestor only`), `Status`, `Review notes: any`. `Clear filters` resets to the default.
- **Review notes** (X-79): `Holds Admin and Security Analyst`; `Holds the Security Analyst Agent role, which CSRM doesn’t use`; `Inactive, still holds {roles}`.
- **Phones:** one card per person: name, `{username} · {email}`, role tags, status, held-since lines, notes.
- **States:** loading table skeleton; filtered `No people match these filters` · `Clear filters`; error `We couldn’t load role holders` · `Try again`.

---

## 10. The change log (D-08, D-12; X-78)

- **Header:** `Export` (title `Export Change log`).
- **Filters** (address-kept chips): `Area` (`Configuration`, `Divisions and business units`, `Risk Types`, `Controls`, `Information Systems`, `Information Assets`, `Shared views`, `Roles`), `Subject` (contains), `Changed by` (person picker, plus `Identity platform` and `CSRM`), `From` and `To` dates.
- **Table** (both densities, newest first, paginated with total; sticky `When`): `When` (instant) · `Changed by` · `Area` · `Subject` (record link to the subject where it still exists: the setting page, the reference record, the divisions page, shared views, or role holders filtered to that person; otherwise its label then, as text) · `Change` (served action label) · `Before` · `After` · `Reason` (long-text column) · `Details` (ghost small, opens the sheet).
- **Changed by:** `{name}`; `Identity platform · {operator}`; or `CSRM · {source}` (served source label, such as `Seed data` or `Keycloak provisioning`).
- **Before and After cells:** one value, or one line per field `{field}: {value}`; after three fields, `and {k} more` (the sheet holds them all). An empty value reads `Not set`. Long values clamp (long-text columns).
- **Details sheet** (X-13): title `Change on {instant}`; a definition list (`When`, `Changed by`, `Area`, `Subject`, `Change`, `Reason`, `Import batch`); a table `Field` · `Before` · `After` with every field, whole; for an import, `Show this import’s changes` (record link filtering the log by batch).
- **History on records** (X-29): reference records and setting pages list their own rows in X-78's entry form.
- **Phones:** one card per change: `{change} · {subject}`, `{instant} · {changed by}`, `{k} {field|fields} changed`, the reason clamped to three lines, `Details`.
- **States:** first-use `No changes recorded yet` · `Changes appear here from the first change after this release. Earlier changes weren’t recorded.`; filtered `No changes match these filters` · `Clear filters`; error `We couldn’t load the change log` · `Try again`.

---

## 11. The manual start (G-20; D-22, D-23; X-80)

### 11.1 In the generation cards (10 §12.1, §12.2; 12 §11.1)

Served from the jobs read's `aiPolicy` block (whether the viewer can start without AI, and why not).

| Card state | Assigned analyst | Any other analyst |
|---|---|---|
| Refused by the policy (12 §11.1's alert) | The alert, then `Start without AI` (outline pill, `PenLine`) | The alert, then one line: `{name}, the assigned Security Analyst, can start it without AI.`, or `Once a Security Analyst picks up this request, they can start it without AI.` (13's `Pick up` offered as today), or for the analyst who raised it 13 family K's `OWN_REQUEST` line |
| Latest run failed or interrupted (10 §12.1, §12.2) | The failed alert and its retry, then `Or start without AI and write the {questionnaire|draft} yourself.` and `Start without AI` | As above |
| Generation allowed, running, or record exists | No control | No control |

**12 §11.1 to §11.3 descriptions are amended** (reversing 12 UI-D24): ` Contact your administrator.` becomes ` The Admin sets this limit in the AI data policy.`; Phase 14's inclusion line gains the same sentence.

### 11.2 Confirmation

`ConfirmDialog` at the confirm size (§4 Dialogs); waits for the server.

| Part | Questionnaire | Assessment draft |
|---|---|---|
| Title | `Start the questionnaire without AI?` | `Start the assessment draft without AI?` |
| Reason (served) | `AI generation isn’t available: this request’s information is classified {level}, above the {ceiling} limit.` · `AI generation isn’t available: no classification is approved for the AI provider.` · `The last generation {failed|was interrupted}.` | the same |
| Body | `You’ll get an empty questionnaire and write its questions yourself. CSRM records that you started it without AI, and why. If the AI data policy allows it later, you can still ask the AI for proposals.` | `You’ll get an empty draft and add its risks yourself. CSRM records that you started it without AI, and why. If the AI data policy allows it later, you can still ask the AI for proposals.` |
| Actions | `Start without AI` (primary), `Cancel` | the same |
| Success | Opens the questionnaire editor, toast `Started the questionnaire without AI. Add the first question.` | Opens the draft, toast `Started the assessment draft without AI. Add the first risk.` |

The new empty record's first-use state: `No questions yet` · `Add the questions the Requestor will answer.` · the editor's existing add action; `No risks yet` · `Add the risks this assessment covers.` · the editor's existing add action.

### 11.3 Provenance (X-80)

- **Analyst:** the provenance header (X-11's place) reads `Started without AI by {name} · {instant}` with a 14px `PenLine`, then `Reason: {served reason}` in `--text-caption` / `--color-text-secondary`. No AI marker shows until an AI proposal is confirmed in the record; those parts then follow X-11.
- **Requestor and participants:** 12 §9.3 unchanged: the record is not `aiAssisted`, so no AI paragraph shows.

---

## 12. Refusal copy (new family AA, added to Phase 10 §10.2 and `refusal-copy.ts`)

Kinds as 10 §10.2. Every refusal keeps typed input.

### AA1. Configuration

| Reason | Copy | Kind |
|---|---|---|
| `CONFIGURATION_CHANGED` | §6.1's stale-version alert | conflict |
| `CONFIGURATION_INVALID` | §6.1's summary and the served field problems | field |
| Reason missing or too long | `Write why you’re making this change.` · `Keep this to 500 characters or fewer.` | field |
| 403 | `CSRM’s configuration is maintained by the Admin.` | blocked |
| Network, timeout or 5xx | `We couldn’t apply that. Your changes are kept. Try again.` | retryable |

### AA2. Lists and the request form

| Reason | Copy | Kind |
|---|---|---|
| `LIST_LABEL_IN_USE` | `“{name}” is used on {n} {request|requests}, so it can’t be renamed. Retire it and add the new name.` | blocked, `Refresh page` |
| Duplicate name | `“{name}” is already a division.` · `“{name}” is already a business unit in {division}.` | field |
| `DIVISION_NOT_ON_LIST` | Field: `“{value}” isn’t on the division list any more. Choose another division.` | field |
| `BUSINESS_UNIT_NOT_ON_LIST` | Field: `Choose a business unit in {division}.` | field |
| Network | `We couldn’t save that. Your input is kept. Try again.` | retryable |

### AA3. Reference data and shared views

| Reason | Copy | Kind |
|---|---|---|
| 403 on a reference write | `Reference data is maintained by the Admin. You can read and export it.` | blocked |
| `RISK_TYPE_RETIRED` | Field and import row issue: `“{name}” is retired. Choose an active Risk Type.` | field |
| `VIEW_OWNER_NOT_ELIGIBLE` | Field: `{name} isn’t an active Security Analyst, so they can’t own a shared view. Choose someone else.` | field |
| View no longer shared or gone (409, 404) | `“{name}” changed since this page loaded. Refresh the page to see it now.` | blocked, `Refresh page` |

### AA4. Manual start

| Reason | Copy | Kind |
|---|---|---|
| `MANUAL_START_NOT_AVAILABLE`, generation allowed | `AI generation is available for this request, so start it with Generate {questionnaire|assessment draft}.` | blocked, `Refresh page` |
| `MANUAL_START_NOT_AVAILABLE`, job running | `A generation is running for this request. Wait for it to finish or fail.` | blocked, `Refresh page` |
| `MANUAL_START_NOT_AVAILABLE`, record exists | `A {questionnaire|draft} already exists for this request. Refresh the page to open it.` | blocked, `Refresh page` |
| `NOT_ASSIGNED_ANALYST` | `Only {name}, the assigned Security Analyst, can start this without AI.` | blocked |
| `REQUEST_UNASSIGNED` | `Pick up this request first, then start it without AI.` with 13's `Pick up` | blocked |
| `OWN_REQUEST` | `You raised this request, so another Security Analyst starts it.` | blocked |

---

## 13. Five-state contract and the premium bar

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Configuration index | §5 | — | §5 | §2 | Default, changed, AI source states |
| Setting pages | Header, then value-table skeletons in the final layout | Recent changes §6.1 | `We couldn’t load {setting name}` · `Try again` | §2 | Edit, conflict, invalid, `Never` warning, source states |
| Divisions | Two card skeletons with three rows each | §7.2 | `We couldn’t load the divisions` · `Try again` | §2 | Active, retired, unused, in use |
| Request form selects | With the form | §7.3 | Family AA2 | — | Retired or off-list recorded value |
| Reference data | 10's list and detail skeletons | Unchanged | Unchanged | §2 | Read-only, retired, owner |
| Shared views | Table skeleton | §8 | §8 | §2 | Owner needs replacing |
| Role holders | Roles and table skeletons | §9 | §9 | §2 | Notes, before-recording dates |
| Change log | Table skeleton | §10 | §10 | §2 | Identity platform and system origins, import batch |
| Generation cards | 10 §12 | — | AA4 | Other analysts' lines | Manual start offered |

| G-4 item | Phase 22 contract |
|---|---|
| Keyboard path for every primary action | Every act is a button or link in DOM order; `Ctrl`/`⌘` `Enter` applies the confirmation and submits in-place forms; Esc cancels; move up and down are buttons; dialogs and sheets trap focus and return it |
| Optimistic feedback with rollback | Retire, reinstate, move, rename, stop sharing, transfer and `Clear` apply at once and roll back with family AA's reason (§5 Optimistic UI). Setting changes and the manual start wait for the server |
| Skeletons | §13 table; forms and dialogs load with `next/dynamic` and a skeleton after 300ms |
| Undo and confirmations | Undo: Risk Type and list retire and reinstate, shared-view acts, `Clear`, discarding edits. Confirmations: every setting change (before and after) and the manual start |
| Empty states that say what to do next | §6.1, §7.2, §8, §9, §10, §11.2 |
| No lost input | 10 §6.3's guard on every setting page and in-place form; edits kept on `CONFIGURATION_CHANGED` beside the newer values (X-56) and on every refusal |
| Density | Comfortable and compact on role holders, the change log, shared views and reference lists |
| Motion | Motion section; reduced motion honoured |
| Phone layouts | Cards per band, level, division, view, person and change; full-screen confirmation and sheets; stacked header actions |
| Every figure opens its records | Role counts, Home rows and change-log subjects link with equal totals; the Admin's usage counts are plain (X-65) because their lists are the analysts' |

---

## 14. Test assertions this contract changes

- **Phase spec** (1440 and 375, axe on each new page): SC1 the Admin sees `Create Control`, `Import`, `Edit Control` and `Retire`; Bob sees `Export` only and the description ` Maintained by the Admin. You can read and export it.`; Bob at `/app/admin/controls/new` sees `You don’t have permission to change Controls`. SC2 `Apply this change to Risk appetite?` with `Now` `6 months` and `After this change` `3 months`, the toast `Risk appetite updated.`; a band change shows Bob's readiness caption `Follows the current rating bands.`; the request form offers the new division; a retired Risk Type is absent from the matrix-row editor and reads `{name} (retired)` on its risk. SC3 role holders `Export Role holders` downloads; the change log row shows the Admin, the instant, `6 months` and `3 months` and the reason. SC4 Bob, Jane and Maya see §2's states at every Admin URL; the Admin sees 10 §11.1's states at analyst URLs. G-20: after the Admin lowers the ceiling, Bob sees `Start without AI`, confirms, and the editor shows `Started without AI by Bob …`; Jane's questionnaire shows no AI paragraph. Each spec restores changed settings in its teardown.
- **Existing specs changed deliberately:** `administration-workflow.spec.ts` (the Admin replaces the analyst); navigation (Admin profile); generation cards (the amended 12 §11.1 descriptions); the request form (selects replace suggestion fields).
- **Unit (Vitest):** the configuration domain module's on-blur checks (bands strictly increasing, appetite monotonic, bounds); X-74's editor in read, edit, conflict and invalid states; the confirmation's comparison rows; X-76's move, retire and reinstate with rollback; X-78's cell composition (`and {k} more`, `Not set`, origins); X-79's notes; X-80's card states per viewer; family AA; capability anchors and the Admin profile.

---

## Copywriting Contract

| Element | Copy |
|---|---|
| Primary CTAs | `Edit scale`, `Edit appetite`, `Edit peer review`, `Edit AI policy`, `Edit retention`, `Review changes`, `Apply change`, `Add division`, `Add business unit`, `Transfer view`, `Save view`, `Start without AI`, `Create {singular}` |
| Other calls to action | `Keep editing`, `Discard changes`, `Keep all mine`, `Take all theirs`, `Retire`, `Reinstate`, `Rename`, `Save name`, `Stop sharing`, `Transfer`, `Clear`, `Details`, `History`, `Export`, `Import`, `Clear filters`, `Open in the change log`, `Show this import’s changes`, `Undo`, `Cancel` |
| Headings and labels | §1.2's h1s; `Rating bands`, `Likelihood`, `Consequence`, `Recent changes`, `Roles`, `People`, `Review notes`, `Held since`, `Identity link`, `Administration`, `Reason for this change`, `Now`, `After this change`, `Before`, `After` |
| Empty state headings | `No changes yet`; `No divisions yet`; `No business units yet`; `No retired entries`; `No shared views yet`; `No changes recorded yet`; `No questions yet`; `No risks yet`; filtered `No {nouns} match these filters` |
| Empty state bodies | §6.1, §7.2, §8, §10, §11.2 |
| Error state | Family AA and the section errors: what happened and what to do next, input kept |
| Destructive confirmation | None destructive. Governance confirmations: `Apply this change to {setting name}?` (§6.1) and `Start the {questionnaire|assessment draft} without AI?` (§11.2). Retiring is reversible (Undo) |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 | Setting values are tables with row headers or definition lists; the band preview is a native table with a caption; radio groups and switches are named; each division card is a list item with a heading |
| 1.4.1 | Bands, `Retired`, notes and origins carry icon and words |
| 1.4.10 | No horizontal scroll at 320px on setting pages, cards and the confirmation; tables scroll inside their named region |
| 2.4.3 | Edit moves focus to the first field; apply returns it to the h1; in-place forms follow X-5; dialogs and sheets return focus to their trigger |
| 2.5.3 | Link and button names begin with the visible label (`Retire {name}`, `Move {name} up`) |
| 2.5.8 | Targets at least 24px; the touch-target height below 768px |
| 3.3.1, 3.3.3 | Field errors say what to fix; the invalid summary links to each field |
| 3.3.4 | Every setting change is reviewed in a confirmation before it applies |
| 4.1.3 | Moves, toasts and the preview's `Preview` label announce politely; the conflict alert is assertive once |
| Automated | Zero serious or critical axe violations on every §1.2 route (read and edit modes), the confirmation, reference pages (Admin and analyst), the request form, the generation card with `Start without AI`, at 1440 and 375 |

---

## Spacing Scale

The §3.9 scale, unchanged. Sections 24 to 32px apart (§3.9 rhythm); 16px inside cards, wells and sheets; 8px between an entry's name and its caption; 12px between unit rows. No exceptions.

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon to text in badges and notes |
| sm | 8px | Name to caption, action rows |
| md | 16px | Card, well and sheet padding, field gaps |
| lg | 24px | Between sections and index cards |
| xl | 32px | Form sections (§4 Forms) |
| 2xl | 48px | Not used |
| 3xl | 64px | Not used |

---

## Typography

The §3.10 scale, unchanged.

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Body (values, descriptions, sentences) | 14px (`--text-body`) | 400 / 500 | 20px |
| Label (captions, notes, attribution) | 12px (`--text-caption`) | 400 / 500 | 16px |
| Heading (sections, cards, dialog titles) | 16px (`--text-heading-sm`) | 600 | 24px |
| Display (page title) | 28px (`--text-heading-lg`) | 400 | 32px |

Tables use `--text-table` and `--text-micro` headers (§4 DataTable). `tabular-nums` on every score, month, year, count and instant. Weights 400, 500 and 600 only.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; tables, cards, dialogs, sheets |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary` | Wells, skeletons, hairlines, captions |
| Accent (10%): ink | `--color-primary`, `--color-on-primary`, `--color-text-link`, `--focus-ring` | Reserved, below |
| Severity (§3.6) | the four risk sets | Band badges and preview cells only |
| Status (§3.5) | warning (`No ceiling set`, `Never` alert, conflict), info (source and read-only notices), danger (invalid summary, errors), success (toasts), neutral (`Retired`) | Always with an icon and words |
| Destructive | `--color-danger-solid` | None used |

Ink is reserved for: the primary pills in the Copywriting table, checked radios, segments and switches, record and figure links, and focus rings. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Unsaved changes bar | §5 "selection panels" (X-54) |
| Confirmation, transfer, rename dialogs; toasts | §5 "Dialog / toast" |
| Details and history sheets | §5 "Drawer / side panel"; fade under reduced motion |
| Retire, reinstate, move rollback | §5 Optimistic UI rollback |
| Edit mode, in-place forms, preview cells | None: instant |
| Rows, cards, figures | None (§6 item 8) |

---

## Proposed CSRM extensions

For the orchestrator to accept. A Phase 22 plan task records them in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 21's X-73. None adds a value.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-74 | §4 Forms, after "In-place edit form" | Settings editor and its change confirmation | "**Settings editor (CSRM extension, 2026-10-01).** A product setting that governs how work is judged has its own page: the current values read as tables or definition lists, a meta line `Changed {instant} by {name}` or `Default values, never changed`, and in the page header a primary `Edit {name}` and an outline `History`. Editing turns the values into fields in place, with on-blur validation, the Unsaved changes bar's count with `Discard changes` and the primary `Review changes`, and the leave warning. Nothing applies until a confirmation dialog at the complex size, a full-screen sheet below 768px, titled `Apply this change to {setting}?`, shows only the changed fields in the before-and-after table of AI proposal items with columns `Now` and `After this change`, states in one paragraph what the change affects from now on and what it never rewrites, and requires `Reason for this change`; `Apply change` waits for the server, then returns the page to read mode with a success toast and no Undo. A change that meets a newer save keeps the edits and follows Edit conflicts; values the server refuses close the dialog, list each problem in an alert linking to its field, and keep the reason. The page ends with `Recent changes`, its latest change-log entries and a link to the log." | D-10, D-25; the direction confirms governance acts but has no before-and-after confirmation for configuration |
| X-75 | §4 Forms, after "Matrix picker" | Band preview matrix | "**Band preview matrix (CSRM extension, 2026-10-01; extends Matrix picker).** Where rating bands are shown or edited, the 5 × 5 matrix is a read-only native table captioned `Rating bands on the 5 × 5 matrix`, likelihood rows highest first and consequence columns, each cell drawn as the Matrix picker's cell (the band's tint, the score and the band icon) with no radio, focus stop or count. Below 768px column headers show the score with the label as the header's accessible name. While bands are edited it is labelled `Preview` and redraws instantly; the confirmation lists each score that changes band as a row with its band badge under `Now` and `After this change`." | D-13; the picker and the counts matrix are interactive or count-bearing |
| X-76 | §4, new "List editor" entry, after "Withdrawn records" | Two-level ordered list editor | "**List editor (CSRM extension, 2026-10-01).** An ordered, two-level list that people choose from, such as divisions and their business units, is edited as one card per first-level entry in list order, its name in `--text-heading-sm` with a plain `Used on {n} {records}` caption, then its second-level entries as rows with hairlines and an outline small `Add {entry}`. Each entry carries icon buttons `Move {name} up` and `Move {name} down` (absent at the ends), a ghost small `Rename` only while nothing uses it, and a ghost small `Retire`; one line under the page description says why a name in use is retired and replaced rather than renamed. Adding and renaming use the In-place edit form. Moving applies at once, keeps focus on the moved control and announces the new position; retiring and reinstating apply at once with an Undo toast. A `Show` segmented control switches between active and retired entries, retired ones grouped under their parent's name. Below 768px the cards stack and the move buttons keep the touch-target height." | D-19; no recorded pattern edits an ordered hierarchy by keyboard |
| X-77 | §4 "Withdrawn records", amendment | Retired reference entries and values off a list | "**Retired entries (CSRM extension, 2026-10-01; amends Withdrawn records).** A reference entry that stops being offered for new choices, such as a Risk Type or a list entry, is retired, never deleted. It carries the status value `Retired` (neutral tone, `Archive`) from the one shared mapping and follows Withdrawn records' `Show` control, but retiring and reinstating need no reason: each applies at once with an Undo toast, and the change log records it. A retired entry is never offered for a new choice and stays on every record that holds it, read `{name} (retired)`. A recorded free-text value that is not on its list reads `{value} (not on the list)`. Filters list active entries, then retired ones with the suffix, then a `Not on the list` group." | D-18, D-19; X-27 requires a reason and covers analyst withdrawal only |
| X-78 | §4 Dialogs, after "Record history" | Change-log entries | "**Change log (CSRM extension, 2026-10-01; extends Record history).** An append-only log of changes is a DataTable, newest first, with both densities and a sticky `When` column: `When`, `Changed by`, `Area`, `Subject`, `Change`, `Before`, `After`, `Reason` and a ghost small `Details`. `Changed by` names the person, or the origin when there is none, as `Identity platform · {operator}` or `CSRM · {source}`. `Subject` is a record link while its subject exists and its label at the time otherwise. `Before` and `After` hold one value or one line per field (`{field}: {value}`) up to three, then `and {k} more`; an empty value reads `Not set`; long values clamp as long-text columns. `Details` opens a Side sheet titled `Change on {instant}` with a definition list of the entry and a `Field`, `Before`, `After` table of every field, whole, and for an import a link to that batch's changes. Below 768px each change is a card. Record history lists a record's own entries in the same form." | D-08, D-12; X-29 shows one record's history, not a cross-record audit log with origins |
| X-79 | §4 Status & risk badges, after "Stages and run outcomes" | Access review notes and role tags | "**Access review notes (CSRM extension, 2026-10-01).** A person's roles are neutral tags. A fact an access reviewer should check, which informs and blocks nothing, is a review note, never a status badge: a 12px `CircleAlert` and the note in `--text-caption` at 500 in `--color-text-primary`, one per line, such as `Holds Admin and Security Analyst` or `Inactive, still holds {roles}`. When a role was granted is `{role}: since {date}`, or `{role}: since before {date}` where the grant predates recording. The page that lists role holders says where roles are assigned and offers no control that assigns, removes or changes one." | D-07; the tone vocabulary has no tone for an advisory access-review fact |
| X-80 | §4 "AI provenance", amendment | Starting a record without AI | "**Started without AI (CSRM extension, 2026-10-01; amends AI provenance).** When AI generation is refused or failed, the person who may start the record by hand sees `Start without AI` as an outline pill with `PenLine` after the refusal or failure, and others see one line naming who can. Its confirmation dialog states the served reason, that the record starts empty and is written by hand, that CSRM records the start and why, and that AI proposals may follow later. Its provenance header reads `Started without AI by {name} · {instant}` with `PenLine` and the reason in `--text-caption`; it carries no AI marker until an AI proposal is confirmed in it, and the Requestor's view says nothing about AI." | D-22, D-23, G-20; AI provenance covers only AI-written records |

---

## Decisions recorded

Made without asking (auto mode), from the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The Admin profile is the Requestor's plus `Reference data` and `Administration`; a dual holder gets the analyst profile plus `Administration`. | D-24; 11 §1.1's capability-chosen profiles. |
| UI-D2 | The divisions nav label is `Divisions and units`; the page h1 is `Divisions and business units`. | The full name risks wrapping in the 256px sidebar. |
| UI-D3 | The Admin's Home adds one `Administration` section with three link rows, rather than a new Home. | D-24 leaves it to the UI-SPEC; 11 D-16's Requestor Home stays the base. |
| UI-D4 | Each setting is edited as a whole, with one version, one confirmation and one reason. | D-10's one envelope and version per key. |
| UI-D5 | Setting changes have no Undo; another change reverses them. | Governance-significant and logged (D-25); the confirmation is the guard. |
| UI-D6 | The band preview while editing is computed by the web's pure module and labelled `Preview`; every applied fact comes from the server. | No preview operation exists (D-03); a draft is not a recorded fact (17.1 D-58). |
| UI-D7 | Band boundaries are selects of the 5 × 5 products, never free numbers. | A boundary between products would mislead. |
| UI-D8 | Peer review is a radio group, not a segmented control. | Four long labels (§4 Forms). |
| UI-D9 | Retiring a Risk Type or list entry needs no reason (X-77). | D-18 and D-19 name Undo and a change row, not a reason; D-10's reason is for settings. |
| UI-D10 | Reordering list entries is buttons, not drag. | Keyboard path (G-4); no drag dependency. |
| UI-D11 | The request form's division and unit are selects; X-67 leaves the request form. | D-19 constrains new values to the list (D-04). |
| UI-D12 | The Admin's usage counts and `Used in` rows are plain. | D-06; the lists behind them are analyst routes. |
| UI-D13 | Shared views do not open the register. | The Admin has no register access (D-05). |
| UI-D14 | Review notes are notes, not status badges (X-79). | They inform and block nothing (D-07); no tone fits. |
| UI-D15 | `Start without AI` is an outline pill, offered only in the refused or failed card states. | D-22: never a choice while generation is available. |
| UI-D16 | 12 §11.1's `Contact your administrator.` becomes `The Admin sets this limit in the AI data policy.` | D-23 reverses 12 UI-D24. |
| UI-D17 | Refusals are family AA. | The spawn prompt. |

---

## Notes carried

- **For the orchestrator to settle:**
  - **UI-D6:** the web previews draft bands; confirm, or have research add a server preview to D-03's configuration group.
  - **Retiring a division** (§7.2): the copy says its units are no longer offered; research confirms whether the server also retires the units or only hides them through the division.
  - **Routes** in §1.2 and **capability names** in §1.1 are proposals (D-24, Planner's Discretion).
  - **UI-D2** and **UI-D3**.
- **For research and the planner:** bounds (`{min}`, `{max}`) for months, years and description lengths; the served readiness item `No executive approver needed` and the round's criteria-differ flag (§6.7); `aiPolicy`'s manual-start fields and reasons (§11.1); served action and source labels for the change log (§10); forms and dialogs load with `next/dynamic` (R-08-34).
- **Earlier contracts this one amends (their plans have not executed):** 10 §11.2 (Administration row), 11 §1.1 (Reference data capability; Admin profile), 12 §11.1 to §11.3 and UI-D24, 14's inclusion refusal line and files retention line, 17.1 §2 (readiness caption and item), X-46's panel (the criteria line), 20 §11.1 (plain for the Admin) and §11.2 (the request form).
- **Shared-file changes needed:** the direction records X-74 to X-80 through a Phase 22 plan task; `refusal-copy.ts` gains family AA; the glossary terms of D-25 (planned by a Phase 22 plan).

---

## UI Considerations

Written inline from the contract. The ui-phase probe replaces them when it runs.

State considerations: 18 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|---|---|---|---|
| empty | Recent changes, divisions, shared views, change log, manual-start records | ✅ covered | §6.1, §7.2, §8, §10, §11.2 |
| loading | Every page and the cards | ✅ covered | §13 |
| error | Settings, lists, views, access review, manual start | ✅ covered | Family AA and section errors |
| permission | Admin URLs for others, analyst URLs for the Admin, reference writes for analysts | ✅ covered | §2 |
| partial | AI policy source states | ✅ covered | §6.5 |
| partial | Assignments that predate recording | ✅ covered | §9 `since before {date}` |
| interaction | Two Admins editing one setting | ✅ covered | §6.1 conflict (X-56) |
| interaction | Invalid values from the server | ✅ covered | §6.1 |
| interaction | Leaving with edits | ✅ covered | 10 §6.3's guard |
| interaction | Retire, move, transfer rolled back | ✅ covered | §7.2, §8, Undo |
| interaction | A setting changed during an open round | ✅ covered | §6.7 |
| zero-one-many | Plurals, counts, fields in a change | ✅ covered | Written-out forms; `and {k} more` |
| overflow | Long descriptions, reasons, values | ✅ covered | Long-text columns, the details sheet |
| phone | Bands, levels, divisions, views, people, changes | ✅ covered | Cards and full-screen sheets |
| figures | Role counts and Home rows | ✅ covered | X-10 equal totals |
| retired values | Records holding retired or off-list values | ✅ covered | §4.2, §7.3, X-77 |
| disclosure | Manually started records | ✅ covered | §11.3 |
| no role assignment | Role holders | ✅ covered | §9 notice; no control |
| screen reader | A move announces its new position once | 🧪 backstop | `{ statement: "With NVDA, Move up on a business unit announces its new position once and keeps focus on the button", verification: backstop }` |
| comprehension | The forward-effect paragraph is understood | 🧪 backstop | `{ statement: "The pilot reads the risk appetite confirmation and states correctly that an open acceptance round keeps its authority", verification: backstop }` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official (local source-owned components) | None new | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

---

## Verification contract

- **Unit and component (Vitest):** §14's unit list and every component in its read-only and refusal states.
- **E2E** (1440 and 375): §14's phase spec with the axe scope; each run restores its settings and leaves the tree clean.
- **Manual (pilot):** the two UI Considerations backstops.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending

---

## Orchestrator amendments (2026-10-01, after the UI check)

The UI checker approved this contract with three flags. These amendments bind the plans:

1. **Retiring and reinstating a division:** retiring a division retires its units on the server too, and the change log records it. Reinstating the division reinstates the units that were retired with it, but not units retired separately before it. §7.2 and X-76's wording say both.
2. **Settled items:** UI-D6 (the in-page band preview, using the same shared rating function the web already uses, with the server re-validating on save), the division cascade above, and the proposed routes, capability names, the `Divisions and units` nav label and the Admin Home section are accepted.
3. **`CircleAlert`** (lucide-react 1.30.0) joins the confirmed icon list for X-79.
