# Phase 22: Admin role and configurable lists - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk criteria; ISO/IEC 27001:2022 clauses 6.1.2 a) and 6.1.3 f), and Annex A 5.3 segregation of duties, 5.15 access control, 5.18 access rights and 8.32 change management) at the G-4 premium bar, consistent with `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md` (decisions 1 to 18, G-1 to G-20). Following stage2-rules §3a, upstream decisions are cited by number, not restated. Grounded in:
- the product gap UAT (UAT-061, and UAT-053's asset half, in `.planning/workstreams/csrm/uat/product-gaps/FINDINGS.md`) and `REPORT.md` §5, §8 (Phase 22) and §9 (decision 1);
- the orchestrator's seeds, each confirmed or corrected (last section);
- the planned outputs of Phases 10 (D-29, D-36, D-37), 11 (D-06, D-13, D-16), 12 (D-09 to D-11, D-26 to D-33; plans 12-02 and 12-07), 13 (D-06, D-10), 14 (D-22; plan 14-03), 17, 17.1 (D-11, D-26 to D-36, D-58; `17.1-RESEARCH.md` "The Configuration Points"), 18 (D-09, D-20 to D-23), 19 (D-05 to D-13, D-18), 19.1 (D-07, D-34), 20 (D-17, D-22 to D-26) and 21 (D-07, D-15, D-25), each CONTEXT with its Orchestrator Confirmations or Seeds section;
- a read of today's code (`<code_context>`).

There is no SPEC.md, no todo matched (`todo.match-phase 22`: 0), no discuss hook is active and no codebase map exists (the grep fallback was used). The discussion log is `22-DISCUSSION-LOG.md`.

**Plans are written ahead.** Phase 22 executes last (order 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Its plans are written against today's code plus every earlier phase's planned outputs, name the earlier plans they rely on (12-02 for `risk-scale.ts` and `csrm/ai/data-policy.ts`, 12-07 for the policy refusals, 14-03 for the attachment policy, Phase 19's export module plans, and the plans of 17, 17.1, 18, 20 and 21 once written), and get a fresh plan check just before execution.

<domain>
## Phase Boundary

An Admin owns CSRM's reference data and its configuration, apart from the analysts' assessment work. The Admin maintains the Risk Type library, controls, systems and assets; the scale descriptions and rating bands; the risk appetite with its acceptance authority and review intervals; the peer-review threshold; the AI data policy; the records retention rule; the division and business-unit lists; and the governance of shared register views. Every change is recorded with who, when, the old and new values and why, and reaches the forms, the AI and readiness from the next act without rewriting anything already recorded. Security Analysts read and export reference data and change none of it. The Admin sees who holds which role, exports it for an access review, and sees every role change, while role assignment stays in the identity platform. The phase also closes the carried items: the Information Asset owner, the manual start when AI generation is refused or unavailable, and the retention setting; and it concludes the service agent's role review. It closes UAT-061.

### In scope
- The Admin role, the re-grant of the Administration Functions, the policy scope and the matrix caller (D-02, D-05, D-06).
- Role holders with their export, the role-change record and the service agent's role review (D-07 to D-09).
- The settings store, forward-only application, the change log, and the five settings (D-10 to D-17).
- Active Risk Types, divisions and business units, shared-view governance and the Information Asset owner (D-18 to D-21).
- The manual start (G-20) and its refusal copy (D-22, D-23).
- Four contract-gap records and their checkpoint, the interface, fixtures, tests and plan shape (D-01 to D-04, D-24 to D-28).

### Out of scope
- Role assignment, user creation or account changes in CSRM (decision 1; 08 D-36 and D-44 stand), and dual control for them.
- Renaming scale levels or bands, a custom (non-product) matrix, changing the impact areas, and configurable assessment types or business criticality (JDL enums).
- Admin-configurable reminder timings (20 D-26) and ageing bands (21 D-12), a disposal or purge job, a shorter retention for read notifications (D-17).
- Breakdowns by division and business unit in reports (20 and 21 deferred them), owners imported by name, and Risk Type controls imported by number (19's deferral).
- Any slice of `apps/csrm/e2e/risk-owner-journey.spec.ts`; Keycloak; live AI in any suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md, abridged) | Decisions |
|---|---|---|
| **ADMIN-07** An Admin role owns reference data and product configuration, and Security Analysts keep read access | (1) the Admin manages Risk Types, Controls, Information Systems and Information Assets and their imports, and a Security Analyst without the role reads but cannot change them, enforced in Strapi; (2) the Admin maintains the scales, the rating bands, the appetite with its acceptance authority and review intervals, divisions and business units, the active Risk Types, shared register views, the peer-review threshold and the AI data policy, and the forms, the AI and release readiness use it; (3) direct URLs to Admin screens show the permission state to everyone else; (4) the Admin holds no Security Analyst rights by default, and every configuration change records who, when, and the old and new values | D-02, D-05, D-06, D-10 to D-20, D-24 |
| **ADMIN-08** The Admin sees who holds which CSRM role, and any role change is audited | (1) a read-only view lists role holders from the identity records and exports for an access review; (2) role assignment stays in the identity platform unless the operator approves it in CSRM with dual control and audit | D-07, D-08, D-09 |

**ROADMAP success criteria (Phase 22), each planned in the UI and the API with its negative cases:**
1. A user with the Admin role manages Risk Types, Controls, Systems and Assets; a Security Analyst without it can read but not change them. (D-02, D-06, D-18, D-21, D-24)
2. The Admin edits the scales, the appetite and its acceptance authority, the division list, the peer-review threshold and the active Risk Types, and the forms, the AI and release readiness use them. (D-10 to D-16, D-18, D-19)
3. Role holders are visible in CSRM and export for an access review, and every configuration change shows who made it, when, and the old and new values. (D-07, D-08, D-12)
4. Direct URLs to Admin screens show the permission state to everyone else. (D-24)

**Closes:** UAT-061. **Carried:** UAT-053's Information Asset owner (ADMIN-05 criterion 1; D-21); the manual start (G-20; D-22, D-23); the attachment retention period (decision 2; D-17); the read-notification retention candidate (19.1 D-34; declined in D-17). **Intent:** R1, O2.
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** The content-type changes are exactly these, through the records and their checkpoint (`<contract_gaps>`), before any schema file changes. Names are proposals the records fix.
  1. **`CsrmConfigurationSetting`** (record 2): one row per setting key, a closed vocabulary (`risk-scale`, `risk-appetite`, `review-policy`, `ai-data-policy`, `record-retention`), holding the current value as a versioned JSON envelope, a version counter, and who changed it last and when. A key without a row reads its code default (D-10).
  2. **`CsrmConfigurationChange`** (record 2): the append-only change log (D-12): area, subject (its reference and its label at the time), action, each changed field's old and new value, reason, the actor (many-to-one `IdamBoxUser`) or, where there is none, the origin (`identity-platform` with the operator's name, or `system` with its source), an optional batch id, and `createdAt`.
  3. **`CsrmDivision` and `CsrmBusinessUnit`** (record 3): label, order and an active state; each business unit belongs to one division (many-to-one, required) (D-19).
  4. **On `CsrmRiskType`** (record 3): an active state, proposed `isActive`, default true (D-18).
  5. **On `CsrmInformationAsset`** (record 3): `owner`, many-to-one `IdamBoxUser`, unidirectional, exactly as `CsrmInformationSystem.owner` (D-21).
  6. **On Phase 17's `CsrmAssessmentRound`** (record 2, by a dated amendment to `phase-17.1-acceptance-rounds-and-decisions.md`): `criteria`, a versioned JSON snapshot of the bands, the appetite and the review policy an acceptance round opened under, with their versions (D-11).

  Vocabulary-only amendments: 06.8's questionnaire governance log and Phase 12's assessment provenance gain the manual origin (record 4); Phase 21's stage-history causes gain the manual start (21 D-07); Phase 19's export views gain `role-holders` and `change-log`. Nothing changes on `IdamBoxUser`, `Role`, `Function` or `FunctionApi` (decision 1; 08 D-36). The lists and settings compete with no JDL entity: the JDL keeps `division` and `businessUnit` as strings, which the lists constrain as 18 D-20 constrains the scale strings, and it has no configuration or history entity. **Reversibility:** one-way - new tables holding configuration and audit facts, and new columns; undoing them needs a data migration.
- **D-02:** Grants follow the chain of 17.1 D-02 and 20 D-02 (specification, both catalogue copies byte-identical, `served-operations.json`, policy configuration, a matrix row per route), with these changes:
  - **The role:** a new `role.admin`, named "Admin", described as owning reference data and configuration and holding no Security Analyst grant.
  - **The re-grant:** the eight Administration Functions keep their ids, names and menu paths and hold the reads (list, detail, Phase 19's exports, Phase 20's usage reads), granted to `role.security_analyst` and `role.admin`. The writes (create, update, import preview and apply, and Phase 19's templates and error reports) move, with names, URLs and descriptions unchanged (19 D-13's move), into four new API-only manage Functions held by `role.admin` only.
  - **New API-only Functions, `role.admin` only:** the configuration reads and writes; the lists' management; Risk Type retirement; the role holders and change log reads with their exports; shared-view governance. The active lists reach every active user through the existing form metadata read (D-19). The two manual start operations are human Security Analyst only, in `HUMAN_ANALYST_ONLY_OPERATIONS` (D-22).
  - **Refusals:** every new operation joins `SERVICE_IDENTITY_REFUSED_OPERATIONS`; nothing new is granted to `role.security_analyst_agent` (D-09).
  - **The policy:** `csrm-authorization.ts`'s Administration scope (today `requireAnalystAdministrationScope`, held only through the human Security Analyst role) accepts a read through the human Security Analyst or the Admin role and a write through the Admin role, never the service identity; the picker branches of `docs/contract-gaps/phase-06-administration-import-contract.md` are unchanged. `/v1/me/access` reports the Admin's operations by the same primitives (ADR 0004).
  - **No role assignment route:** 08 D-36 and D-44 stand (decision 1).

  **Reversibility:** costly - grants in both catalogue copies, the policy and every matrix row.
- **D-03:** The API changes are these groups, and no others. Paths are proposals within these families; research fixes them.
  1. **Configuration:** a read and a write per setting key; the write carries the version the Admin saw and a reason (D-10).
  2. **Lists:** the Admin's list read (retired entries and an in-use flag included) and create, update (label correction, order), retire and reinstate; the form metadata read gains the active lists (D-19).
  3. **Risk Types:** retire and reinstate, the status filter on the list, and the active column in import and export (D-18).
  4. **Information Assets:** `owner` on create, update, detail, list and export (D-21).
  5. **Role holders:** a filtered list read and its export (D-07).
  6. **Change log:** a filtered list read and its export (D-12).
  7. **Shared views:** list the shared views, rename, unshare and transfer (D-20).
  8. **Manual start:** start a questionnaire without AI, and start an assessment draft without AI (D-22); the generation-jobs read's `aiPolicy` block (12 D-29) says whether the viewer can start without AI.
  9. **Closed refusal reasons** join Phase 10's vocabulary: `CONFIGURATION_CHANGED`, `CONFIGURATION_INVALID`, `DIVISION_NOT_ON_LIST`, `BUSINESS_UNIT_NOT_ON_LIST`, `LIST_LABEL_IN_USE`, `RISK_TYPE_RETIRED`, `VIEW_OWNER_NOT_ELIGIBLE`, `MANUAL_START_NOT_AVAILABLE`, reusing `OWN_REQUEST`, `REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST` (13).

  **Reversibility:** costly - published operations, fields and codes.
- **D-04:** What this phase reverses or narrows, each named in its record:
  - **The brief's "Security Analyst Library and Inventory Management"** and v1's Administration grants (ADMIN-01 to ADMIN-04; the "explicit human Security Analyst Administration scope" of `phase-06-administration-import-contract.md`): analysts read and export; the Admin creates, edits and imports (decision 1; UAT-061). A plan adds a dated amendment note to that brief section, as ADR 0001 received for G-10.
  - **Phase 12 D-27:** the ceiling becomes the Admin's setting; the environment variable only bootstraps it (D-16).
  - **Phase 12 D-11 and 16 D-38's fixed AI Accept rule:** the limit stays, and the appetite can narrow it (D-14).
  - **Phase 12 D-33 and 16 D-44 ("the agent keeps its other grants"):** the agent's explicit grants are withdrawn (D-09).
  - **20 D-22's free text with suggestions:** lists; X-67's suggestion field gives way to list selects on the request form (D-19).
  - **The seeds' reconciliation of reference data** (`seed-csrm-data.ts`'s controls, the development Risk Type seeds): create-only from this phase (D-06).
  - **Unchanged:** who shares a view (18 D-09); 19.1 D-34; 14 D-22's absence of disposal; decisions 15 and 16; 08 D-36 and D-44.

### The Admin role and the access review (ADMIN-07, ADMIN-08; decision 1; G-1)

- **D-05:** The role.
  - It is explicit and assigned in the identity platform (the IdamBox User records, administered outside CSRM's API), never in CSRM (decision 1; ADMIN-08 criterion 2; 08 D-36).
  - Its holder has the Requestor birthright like any active user: they raise requests, decide risks as a nominated owner or approver, and read their own notifications and reminders (the 19.1 and 20 seams).
  - It holds no Security Analyst grant (decision 1; G-1). Every analyst route refuses it (403), and it is never eligible as assignee, reviewer or peer approver, because those predicates need the human analyst role (13 D-06; 17.1 D-13). As any first-line person, an Admin may be a risk owner, executive approver or treatment owner (19.1 D-07's predicate); the change log and forward-only application (D-11) are the compensating controls.
  - IdamBox grants are additive, so a person given both Admin and Security Analyst holds both sets of rights. CSRM does not refuse the combination; the role holders view flags it for the access review (D-07).
- **D-06:** Reference data (ADMIN-07 criterion 1; SC1).
  - **The Admin** creates, edits and imports Risk Types, Controls, Information Systems and Information Assets, with every existing rule (natural keys, closed DTOs, Phase 19's import flow), and retires Risk Types (D-18).
  - **A Security Analyst** reads every list and detail, searches (Phase 10 D-29's control search), exports (19 D-13) and reads usage (20 D-24), and changes nothing. Strapi refuses every write (403); the web shows the pages read-only, without New, Import, Edit or Retire, and says who maintains the data.
  - **Usage for the Admin:** plain counts with no links (X-65's plain form), because the lists they open are the analysts'.
  - **Pickers** stay as they are (the 06 record's branches; Phase 10 D-28), offering only active Risk Types for a new choice (D-18).
  - **Change rows:** every create, update, retire, reinstate and import apply writes one per record, with old and new values and an import's batch id (D-12). Released records name reference records by their current names, and the log keeps every earlier name: decision 9 covers the assessment's own content, and decision 15 lets the Admin edit titles.
  - **Seeds stop overwriting:** `seed-csrm-data.ts`'s control reconciliation and the development Risk Type seeds create what is missing and never update an existing record, so an Admin's edit survives every restart. Phase 10 D-36's title load runs before this phase; a later vendored correction reaches existing controls through the Admin's import, recorded like any change.
- **D-07:** Role holders (ADMIN-08 criterion 1; SC3).
  - One Admin-only read lists every IdamBox User from the identity records: display name, username, email, account status, explicit roles (active users hold the Requestor birthright implicitly), whether linked to Keycloak (`externalSubject` set), and since when each role is held (from D-08's rows; "before {date}" where the assignment predates recording).
  - Filters by role (including "Requestor only") and status, defaulting to holders of an explicit role. A summary lists each role with its description and holder count.
  - Review notes, which inform and block nothing: an active holder of both Admin and Security Analyst (D-05); any holder of the Security Analyst Agent role (D-09); an inactive user still holding an explicit role.
  - Exports through Phase 19's module (19 D-05 to D-11, D-17, D-18): CSV and XLSX with the About sheet, logged.
  - Read-only: nothing assigns, removes or changes a role or an account, and the page says where roles are assigned.
- **D-08:** Role changes are recorded (ADMIN-08's "any role change is audited").
  - A document middleware (ADR 0002's pattern, always on) writes a `role-assignment` change row in the same transaction as every create, update or delete that changes an IdamBox User's roles or account status, whichever side of the user-role relation is written (a user's roles or a role's users), and whatever the path: the identity platform's administration in the Strapi admin panel, the seeds, or Keycloak provisioning.
  - The row holds the user, the roles before and after, the status before and after, and the origin with the operator: the administration user's name where the request carries one, otherwise `system` with its source.
  - Recording starts at deployment, with no reconstruction (21 D-08's posture). CSRM never assigns roles: ADMIN-08 criterion 2's dual-control path is not taken (decision 1).
- **D-09:** The service agent's role review (12 D-33; the 13, 15, 16, 17 and 19.1 seams).
  - No product path or planned workflow uses `role.security_analyst_agent`: AI runs are human-initiated (12 D-32, D-33).
  - Least privilege: every explicit grant it still holds is withdrawn in both catalogue copies, and the role stays catalogued with a description saying it holds no grant until an approved automation workflow defines its own Functions.
  - The Requestor birthright rule is unchanged (AGENTS.md), so a holder keeps only the birthright, less every operation Strapi already refuses the service identity. Those explicit refusals stay as defence in depth (`HUMAN_ANALYST_ONLY_OPERATIONS`, `SERVICE_IDENTITY_REFUSED_OPERATIONS`, 19.1 D-07's predicate), and the access review flags every holder for deactivation in the identity platform (D-07).
  - The matrix's `serviceAgent` column turns to 403 on every route its explicit grants reached; its Requestor rows are unchanged, and the seeded agent identity stays as the proof.
  - Reverses 12 D-33's and 16 D-44's "keeps its other grants".

  **Reversibility:** costly - catalogue grants and the tests that proved agent access.

### Configuration: store, forward-only application and the change log (ADMIN-07 criteria 2 and 4)

- **D-10:** The settings store.
  - **Five keys,** each with a closed, versioned envelope, one parser, a code default and one Admin write: `risk-scale` (D-13), `risk-appetite` (D-14), `review-policy` (D-15), `ai-data-policy` (D-16) and `record-retention` (D-17).
  - **Defaults:** a key without a row reads its default (decision 8, decision 17, 12 D-26, 14 D-22), so a fresh database behaves as the decisions set it, and nothing is written at boot.
  - **Writes:** only through the Admin's operation, carrying the version the Admin saw (`CONFIGURATION_CHANGED` when another change landed), validated by the parser (`CONFIGURATION_INVALID`, naming each problem), and with a required reason (1 to 500 characters, Phase 16's reason parser), because each key changes how risk is judged, reviewed, sent to AI or kept. The row and its change row (D-12) are written in one transaction.
  - **Reads:** the configuration points keep their synchronous getters and functions (12 D-10's `risk-scale.ts`, 17.1 D-11's `review-policy.ts`, 12-02's `csrm/ai/data-policy.ts`, 14-03's attachment policy), whose bodies now return the Admin-maintained value from one in-memory store, loaded at boot and replaced after each committed change (17.1-RESEARCH, "The Configuration Points"). The functions keep their explicit argument, which a round's snapshot uses (D-11). Strapi runs as one process (R-08-36), and the record adds to that residual the refresh a second process would need.
  - **Projection:** the server projects every derived fact (authority, a needed approver, peer approval needed, the policy outcome); the web never computes one (17.1 D-58).
- **D-11:** Changes apply forward.
  - **Nothing recorded moves:** no setting change rewrites a stored value, a recorded decision or a released record. Each act evaluates under the configuration current at that act.
  - **Acceptance rounds keep theirs:** "Submit final assessment" records the bands, the appetite and the review policy it opened under (D-01 item 6), and every decision, approval, validity check and review date in that round uses that snapshot (17.1 D-26, D-36; 17.1-RESEARCH's recommendation). A change therefore reaches an assessment at its next submission.
  - **Decisions:** recorded decisions keep the authority and review date they hold (17.1 D-32); Phase 20's decision review renews under the appetite current at the review, and refuses with `REVIEW_AUTHORITY_MISSING` where that authority has nobody named (20 D-17).
  - **Readiness** (17.1 D-19; 18 D-21) lists what a change makes outstanding on unreleased work, each item saying it follows the current configuration: a stored rating outside the new bands ("Use {rating}"), an executive approver now needed, or one no longer needed (a "Clear" fix), and peer approval now needed. Nothing changes on its own.
  - **Released risks** keep their stored ratings (decision 9; 18 D-21).
- **D-12:** The change log.
  - **What it holds:** one append-only record of every configuration, list, reference data, shared-view and role change: who (or the origin), when, the area, the subject with its label then, the action, each changed field's old and new value within the field's own bounds, the reason, and an import's batch id.
  - **Who writes it:** only D-03's operations and D-08's middleware, in the transaction of the change. No route writes it; no row is updated or deleted; it is never deleted.
  - **Who reads it:** the Admin, paginated and newest first, filtered by area, subject, actor and date range, with its export through Phase 19's module; each setting page also shows its own latest changes. Everyone else is refused (403).
  - **The admin panel:** the settings and log types are hidden from Strapi's Content Manager where Strapi allows it; otherwise the residual is recorded as 14 D-08 records the Media Library (privileged operator access outside CSRM's role model).

### The settings (decisions 2, 8, 14 and 17; G-3)

- **D-13:** The scale and bands (decision 8; 12 D-10; 18 D-20 to D-22).
  - **Editable:** each likelihood level's description; each consequence level's description for each of decision 8's six impact areas; and the three band boundaries over the 5 × 5 products (the highest product for Low, Moderate and High; Critical above), strictly increasing, each band holding at least one product. Defaults: decision 8.
  - **Fixed in this phase:** the 5 × 5 structure, the scores, the five level labels per axis, the four band labels and the six impact areas, because stored values, the AI's output schemas, filters, imports and the risk tokens (direction §3.6) carry them.
  - **Reach:** the published scale (18 D-20) carries the current descriptions and bands to the matrix picker, the risk table, the import template's Notes sheet (18 D-23), the heat map (21 D-15) and every derivation (18 D-22); Phase 12's prompts receive them, bounded, as configuration and never inside the untrusted data block.
- **D-14:** The appetite (decision 8; 17.1 D-26 to D-30, D-36, D-58).
  - **Per band:** the authority (one of 17.1 D-32's three: the risk owner; the risk owner with the executive approver's approval; the executive approver alone, as a time-limited exception), whether treatment is expected (an Accept rationale must then say why treatment is not practicable, 17.1 D-27; decision 8's "Treatment is required"), and the review interval in whole months (bounded; proposed 1 to 24). Defaults: decision 8's table.
  - **Constraints,** from Low to Critical: the authority never weakens, treatment once expected stays expected, and intervals never lengthen.
  - **Derived:** whether a risk needs an executive approver (17.1 D-17) and whether a decision is an exception (17.1 D-43) follow from the authority; the participant projection carries the authority and whether treatment is expected.
  - **The AI's Accept rule:** decision 8's limit stays fixed (Low or Moderate, with a rationale; 12 D-11, 16 D-38), and the AI may propose Accept only where the current appetite also lets the risk owner decide alone with no treatment expected. A tightened appetite narrows the AI; a widened one never widens it (17.1-RESEARCH).
- **D-15:** The review policy (decision 17; 17.1 D-11 to D-14). The Admin chooses when peer approval is needed: any Critical residual risk (the default), any High or Critical, every assessment, or never. "Never" is allowed (decision 17), with its reason and a confirmation saying submissions will need no second analyst. "Mark reviewed" and submission readiness read it through 17.1 D-11's function, and a round records the policy it opened under (D-11).
- **D-16:** The AI data policy (G-3, G-7, G-20; 12 D-26 to D-31).
  - **Two values:** the provider's approved ceiling (one of the four classifications), and the classification assumed for a request with no classified asset: Internal by default (12's Orchestrator Confirmation A1), or Restricted or Critical Infrastructure Sensitive, never Public, because unlabelled data is never presumed public.
  - **Bootstrap:** until the Admin first records a ceiling, the policy module reads `CSRM_AI_DATA_CLASSIFICATION_CEILING` exactly as 12 D-27 defines it (in development unset means no ceiling; elsewhere generation is refused until it is set), and the backend `.example` keeps the variable, described as the bootstrap value. Once recorded, the Admin's value governs, and the variable is ignored with one boot log line naming the source when they differ. The Admin's page shows the source in force.
  - **Every refusal** (12 D-28; Phase 14's inclusion refusal) reads the same module, and a job checks again when it runs (12 D-28), so a lowered ceiling refuses a queued job.
  - **Suites:** both harnesses keep pinning the variable empty (12 D-31) and start with no setting row; tests set values through the Admin's operation and restore them.
- **D-17:** Records retention (decision 2; 14 D-22; 19.1 D-34).
  - **One value:** assessment records, and the files that follow them, are kept for whole years after the request closes (default 7; bounded, proposed 1 to 99), read through 14-03's attachment policy point.
  - **Its effect today:** the Admin's recorded rule, the retention line in the files section's copy, and the value the production bucket's lifecycle rules implement as deployment configuration (G-7). No disposal job is built: 14 D-22 stands, and disposal, legal hold and purge stay deferred.
  - **Read notifications:** a shorter retention is declined, and 19.1 D-34 stands: notifications are the record that people were told (G-18), hold little personal data, and no record class has disposal yet.

### Lists and reference records

- **D-18:** Active Risk Types (decision 14; 12 D-09).
  - The Admin retires and reinstates a type, with an Undo toast (G-4) and a change row; nothing is ever deleted.
  - A retired type is excluded from the AI's library (12 D-09) and from new choices in the risk editor, the table and imports (`RISK_TYPE_RETIRED`). It stays on every risk that has it, read "{name} (retired)", in Administration under a status filter (the X-27 pattern), and in register and report filters.
  - The Risk Type import and export gain the active column, with Phase 19's flag values (CSV-02 criterion 2).
- **D-19:** Divisions and business units (decision 1; 20 D-22).
  - **The list:** two levels, divisions and each division's business units. Each entry has a label (unique, case-insensitive, among divisions or within its division), an order and an active state.
  - **Changes:** add, reorder, retire and reinstate (Undo toast). A label is corrected only while no request uses it (`LIST_LABEL_IN_USE`); otherwise the Admin retires it and adds the new one, so no request's recorded value is rewritten. A unit never moves between divisions: retire and add.
  - **Requests:** `division` and `businessUnit` stay JDL strings. A create or update that sets either to a new value must name an active entry, with the unit inside the chosen division (`DIVISION_NOT_ON_LIST`, `BUSINESS_UNIT_NOT_ON_LIST`); an unchanged stored value is always accepted, so earlier drafts still save and submit. The form offers active entries through the form metadata read (any active user), with units filtered by division, and shows a recorded value that is retired or off the list as recorded, marked.
  - **Filters:** analysts' filters (20 D-22) offer the list's entries, active and retired, then any recorded values not on the list, from 20 D-22's suggestions read, which stays for analysts and is withdrawn from every other caller.
  - **Fixture:** the development seed fills the lists from the seeded requests' values (Technology, and Customer and Digital, with their units).
- **D-20:** Shared register views (decision 1; 18 D-09; 20 D-23).
  - Sharing stays the owner's act (18 D-09), and the built-in views stay in code.
  - The Admin governs the shared set through definitions only, never rows: a list of every shared view (key, name, owner and their status, when shared, last change); rename; unshare, which returns the view to its owner as personal; and transfer to an active human Security Analyst when its owner has left or moved (`VIEW_OWNER_NOT_ELIGIBLE` otherwise). Each act is a change row with an Undo toast.
  - An inactive owner's shared views keep serving the team until transferred or unshared.
- **D-21:** The Information Asset owner (Phase 10's carry; UAT-053; ADMIN-05 criterion 1).
  - Optional; any eligible person (19.1 D-07's predicate), set by the Admin through the hardened people search (G-17).
  - Shown by name on the asset's page and in its list beside its classification (Phase 10 D-37's system pattern, an inactive owner marked), in the asset export, and to analysts wherever an asset's details show. Participant projections keep only the asset's name (17 D-25).
  - Owners imported by name stay deferred (19's deferral; names are ambiguous).

### The manual start (G-20)

- **D-22:** Two operations: start a questionnaire without AI, and start an assessment draft without AI.
  - **Who:** the request's assigned analyst only (13 D-10's `assertAssignedAnalyst`; G-1's `OWN_REQUEST`), human Security Analyst only.
  - **When:** at the same lifecycle point as the matching generation (a submitted request with no questionnaire; submitted answers with review complete and no assessment), and only when generation is refused or unavailable (G-20): the policy refuses (12 D-28's `AI_CLASSIFICATION_ABOVE_CEILING` or `AI_POLICY_NOT_CONFIGURED`), or the record's latest generation run failed or was interrupted (12 D-20). Refused otherwise, while a job runs, or once the record exists (`MANUAL_START_NOT_AVAILABLE` with the reason). Choosing to work without AI while generation is available is not offered (deferred).
  - **How:** a confirmation names the reason and says the analyst will write the content by hand. The result is an empty questionnaire, to which the analyst adds questions through the existing operations (QUES-08), or an empty draft, to which the analyst adds risks. Phase 15's and 16's AI proposals can follow later, whenever the policy allows them.
- **D-23:** What a manual start records, and the refusal copy.
  - **One transaction:** the record; the lifecycle facts a completed generation writes, minus every AI fact (no run, no generation date); the origin `manual` with the analyst, the time and the reason (06.8's governance log for the questionnaire, Phase 12's provenance for the assessment); and Phase 21's recorder (21 D-07), which appends a row only if the stage changed.
  - **Disclosure** (12 D-23; INT-06 criterion 3): the analyst's provenance header reads as started without AI by the analyst, and the Requestor's and participants' views never say AI assisted such a record, unless a later AI proposal was confirmed in it.
  - **Copy:** the refusal (12 UI-D24; Phase 14's inclusion refusal) names the Admin's AI data policy in Administration instead of the deployment variable, and offers "Start without AI" to the assigned analyst; other analysts see who can start it.

### Interface

- **D-24:** Surfaces and navigation.
  - **Profiles** (11 D-06, D-13): the Admin gets the Requestor's sections plus an Administration section (reference data, configuration, lists, shared views, role holders and change log; labels the UI-SPEC's). Analysts keep "Reference data" (11 D-08), read-only. A person holding both roles gets both.
  - **Routes** stay under `/app/admin/`: reference data at today's `[collection]` routes, the rest as static segments the UI-SPEC names. A configuration index leads to one page per setting.
  - **Capabilities** (presentation only; ADR 0004): `administration:manage` splits into a reference-data read (anchored on the four list reads, for analysts and the Admin) and a manage capability (the writes), plus configuration and access-review capabilities, each anchored to its operations in `strapi-capabilities.ts`; the development mapping gains the Admin.
  - **The permission state (SC4):** every Admin-only page, and the reference data new, import and edit pages, render it (UX-06 criterion 5's pattern) for anyone without the capability, and the API refuses. The Admin gets the same state at every analyst page.
  - **Home:** the Admin lands on the Requestor Home (11 D-16); whether it shows an Administration card is the UI-SPEC's.
- **D-25:** The premium bar (G-4) and values.
  - **Confirmations** for every setting change and the manual start, showing before and after, the reason field and the forward-only effect ("applies from the next submission; recorded decisions keep their authority"). Undo toasts for retire and reinstate (Risk Types, list entries) and the shared-view acts. Optimistic feedback with rollback; skeletons; empty states that say what to do next; keyboard paths throughout.
  - **No lost input:** Phase 10's navigation guard on every settings and list form, and a stale-version refusal keeps the Admin's edits beside the newer values.
  - **Density and phones:** comfortable and compact density on the role holders and change log tables; phone layouts as cards and sheets (one card per band for the appetite, one per level for the scale).
  - **Values** come only from `docs/design/csrm-design-direction.md`. Reused: X-2 (record picker), X-10, X-13 (side sheet), X-14 (Undo toast), X-27 (the withdrawn pattern for retired entries), X-29 (record history, for a setting's and a reference record's changes), X-30 (export) and X-65 (usage, plain for the Admin). New patterns (at least the settings editor with its before-and-after confirmation, the two-level list editor and the change-log entry) are proposed from the first free X-n the orchestrator gives, each recorded in the direction by a plan task before the task that uses it.
  - **Route budgets** (R-08-34): settings pages render on the server, with small, zod-free client forms.
  - **Copy** uses "Admin", "Reference data", "Retire", "Reinstate", "Start without AI", "Role holders" and "Change log"; exact strings are the UI-SPEC's. A plan adds "Admin (role)" and "Retired (Risk Type, list entry)" to the root `CONTEXT.md` glossary.

### Fixtures, verification and plan shape

- **D-26:** Development fixtures.
  - **The Admin persona:** an active user holding the Admin role only (with the birthright), seeded behind `IDAMBOX_SEED_CSRM` and the development identity, and offered by the development sign-in. It gets the fixed Keycloak id `5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e05` (after Phase 17's `…5e03` and 17.1's `…5e04`) in `apps/backend/src/keycloak/development-fixture-subjects.ts`, with a matching user in `idp/keycloak/import/idambox-realm.json`, changed together. The unit test that the fixture ids match the realm import proves them; nobody starts Keycloak, no flag changes, and the OIDC tests stay green.
  - **Harnesses:** the Strapi harness gains an `admin` identity; the web's development roles and the E2E `signInAs` gain the persona. Its name and email are the planner's.
  - **Data:** the seed fills the lists (D-19) and nothing else; settings start at their defaults.
- **D-27:** Tests (stage2-rules §3).
  - **Strapi unit:** every setting parser and constraint (band boundaries, appetite monotonicity, the AI policy's values), the getters and functions under an explicit argument, the round snapshot's evaluation, the narrowed AI Accept rule, list rules, the role-change diff and the review notes.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test): every grant and refusal in `<authorisation>`; a write with its change row in one transaction, and a refused or stale write with none; forward application (a band change makes a stored rating outstanding; an appetite change during a round leaves that round under its snapshot, and the next submission uses the new appetite); the AI policy's precedence and a queued job refused after the ceiling drops; the middleware's rows for writes on either side of the user-role relation; the manual start's gates and records; the agent refused on every route its grants reached.
  - **The matrix:** an `admin` caller on every row, whose helpers default it to the other Requestor's outcome on Requestor routes and 403 on analyst routes, with 200 only on Admin routes; the `serviceAgent` column updated (D-09).
  - **Web unit (Vitest):** parsers, zod-free domain modules, every new component with its read-only and refusal states, the confirmations, Undo and rollback, and the capability anchors.
  - **Playwright** (`apps/csrm/e2e/`), at 1440px and 375px with axe on each new page, leaving the tree clean (Phase 8 D-12; G-6): a phase spec (named by the planner) proving SC1 to SC4. The Admin manages each reference type, and Bob reads them without controls; the Admin edits a scale description, a band boundary, the appetite, the review threshold and a division, and retires a Risk Type, and the request form, the matrix picker and Bob's readiness show each; the role holders export downloads; the change log shows who, when, old and new; Bob, Jane and Maya get the permission state at every Admin URL, and the Admin at analyst URLs; Bob starts without AI after the Admin lowers the ceiling. A spec that changes a setting restores it in its own teardown, because the run shares one Strapi database (`workers: 1`). `administration-workflow.spec.ts` changes deliberately (the Admin replaces the analyst). No journey slice: `risk-owner-journey.spec.ts` stays green under the defaults.
- **D-28:** Plan shape and size.
  - **Serialised by shared files,** one owner per file per wave: the specification and the generated client; both catalogue copies and `served-operations.json`; the matrix, parity and chain guards; `csrm-authorization.ts` and `effective-access.ts`; `risk-scale.ts`, `review-policy.ts`, `csrm/ai/data-policy.ts` and the attachment policy; the administration API folder and `seed-csrm-data.ts`; the request workflow; the acceptance round service; the web's administration feature, navigation profile, capability mappings, request form and the E2E sign-in helper.
  - **Waves:**
    1. the four records and their checkpoint, with the pure modules alongside (setting parsers and defaults, the appetite constraints, list rules, the role-change diff);
    2. the schema;
    3. the role, the re-grant, the policy scope, `/v1/me/access` and the `admin` matrix caller;
    4. the settings store, the change log and the configuration operations; the getters switched to the store; the round snapshot;
    5. Admin-only reference writes with change rows, create-only seeds, the asset owner and Risk Type retirement;
    6. the lists and the request field rule;
    7. role holders, the role-change middleware, and the change log reads with exports;
    8. shared-view governance and the manual start;
    9. the agent's grants withdrawn across the catalogue and the matrix;
    10. the web: profiles, capabilities, settings, lists, read-only reference pages, role holders, change log, shared views, the manual start and copy;
    11. fixtures, the phase spec and the full gate: `api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`.
  - **Size:** L. The ROADMAP says M, but the carried items, the role review and the `admin` matrix caller push it to L. If the plan count runs high, the trim seam is shared-view governance (D-20) and the agent's withdrawal (D-09), planned last.

### Planner's Discretion
- Module placement, for example `apps/backend/src/csrm/configuration/` (the store, parsers, defaults and the role-change diff), new API folders for the setting, change-log and list types, and web `apps/csrm/src/features/configuration/` and `features/access-review/` beside `features/administration/`.
- Names of types, operations, Functions, keys, reason codes and constants within the families above, and the Admin persona's name and email.
- How plans split, provided D-28's serialisation and order hold.

### Open for research
- How a document middleware learns the administration user behind a Strapi admin panel write, and how a write to a role's users (the other side of the relation) reaches the middleware.
- Hiding the setting and log types from the Content Manager in this Strapi version, or recording the residual.
- The round snapshot's shape and every reader that must use it (the decision-state derivation, approval sequencing, review dates, validity, release readiness), and how the snapshot evaluator meets the getters.
- The readiness items a change can raise and their fixes, within 17.1 D-19 and 18 D-21.
- Whether Risk Type retirement is a field on the existing update or its own act; whether a queued draft keeps the library it read.
- Extending the form metadata read with the lists, and how the request form and 20 D-22's filters consume them.
- The lifecycle facts each manual start writes (what generation writes to the request, questionnaire and assessment, minus the AI facts), and the "latest run failed or was interrupted" condition from Phase 12's runs.
- Every test and matrix row that proves the agent's explicit grants today.
- How the usage reads (20 D-24) admit the Admin's read scope while counting the same population, with no list behind the counts.
- Bounds: interval months, retention years, description and reason lengths.

### Open for the UI-SPEC
- Section and page names; the configuration index; the scale and appetite editors at 1440px and 375px; the before-and-after confirmation; the two-level list editor.
- The role holders and change log tables and their phone cards; the source line on the AI data policy page.
- Read-only reference pages for analysts; the manual start control in the job panels; the Admin's Home.
- Refusal, source and forward-only copy, through the one status mapping where a value is a state.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Decisions |
|---|---|---|
| #1 Admin role | Reference data and configuration, a read-only exportable view of role holders, role assignment in the identity platform, no analyst grants, every change recorded | D-02, D-05 to D-08, D-12, D-20 |
| #2 Attachments | Retention 7 years after closure, set by the Admin | D-17 |
| #8 Scales, matrix and appetite | The 5 × 5 scales, bands, authority, intervals and the AI Accept limit; "defaults the Admin can change" | D-13, D-14 |
| #9 After release | Released records and stored ratings never move | D-06, D-11 |
| #12 Exports | Role holders, change log and reference exports in the viewer's scope, logged | D-07, D-12 |
| #14 Risk Types | Active types for the AI; retired, never deleted | D-18 |
| #15 Control library | The Admin edits titles | D-06 |
| #17 Review before release | The peer-review threshold the Admin moves or turns off | D-15 |
| G-1 Separation of duties | The Admin holds no analyst grants and is never assignee, reviewer or peer approver | D-05 |
| G-3, G-7 AI data policy | The Admin's ceiling; fail closed in production; development has none by default | D-16 |
| G-4, G-6 | The premium bar; the pilot approves the records; Playwright leaves the tree clean | D-25, D-27, `<contract_gaps>` |
| G-14 The risk decision | The three authorities the appetite assigns | D-14 |
| G-17 People search | The asset owner is found by name | D-21 |
| G-20 Manual start | Refused or unavailable generation has a way forward | D-22, D-23 |

**Conflicts:** none between the ROADMAP entry and these decisions. Readings recorded, and named in the return:
1. Decision 1 reverses the project brief's "Security Analyst Library and Inventory Management" in part (analysts read and export; the Admin edits and imports). Decision 1 is later and operator-delegated, and ADMIN-07 encodes it (D-04).
2. ADMIN-08's "any role change is audited", with assignment outside CSRM, is met by recording every change made to the identity records (D-08), not by assigning roles.
3. Decision 8's "defaults the Admin can change" covers descriptions, band boundaries and the appetite; labels and the structure stay fixed in this phase (D-13).
4. Decision 8's AI Accept limit is not an Admin setting: the appetite narrows it but never widens it (D-14; 17.1-RESEARCH).
5. G-7's "refused until the Admin sets the classification ceiling" counts a deployment value as set until the Admin records one, the bootstrap the orchestrator asked for (D-16).
6. Decision 2's Admin-set retention, with no disposal job, is a recorded rule (D-17); the read-notification retention candidate is declined.
7. 20 D-26 left its reminder policy "for Phase 22 to take over"; it stays in code, because G-18 and NOTIFY-02 fix seven days and decision 1 does not list it.
8. The service agent's role review concludes with its explicit grants withdrawn, reversing 12 D-33 and 16 D-44 in part (D-09).
9. The ROADMAP's size M becomes L (D-28).
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoint

Each record follows the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and the Phase 16 to 21 records: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, and Migration.

1. **`docs/contract-gaps/phase-22-admin-role-and-access-review.md`**
   - **The gap:** the catalogue has no Admin; every Administration Function is the analyst's; nothing lists role holders or records a role change (UAT-061).
   - **The extension:** D-02's role, re-grant and policy scope; D-07's read and export; D-08's `role-assignment` rows (in record 2's log); D-09's withdrawal.
   - **Dated amendments:** `phase-06-administration-import-contract.md` (the scope), `phase-19-exports-and-export-log.md` (two views; templates and error reports move with imports), Phase 20's usage reads (their grants), and the catalogue design notes.
   - **Not added:** role assignment, user or account writes, any IAM route, dual control.
2. **`docs/contract-gaps/phase-22-configuration-and-change-log.md`**
   - **The gap:** decision 8's scale, bands and appetite, decision 17's threshold, G-3's ceiling and decision 2's retention are code or deployment values the Admin cannot change, and nothing records a change.
   - **The extension:** D-01 items 1, 2 and 6, with D-10 to D-17's envelopes, defaults, bounds and the forward-only rule.
   - **Dated amendments:** `phase-17.1-acceptance-rounds-and-decisions.md` (the round snapshot, answering 17.1-RESEARCH's open question), `phase-18-risk-scales-and-rating-override.md` (the scale's source), `phase-12-ai-run-record-and-provenance.md` (the ceiling's source and the narrowed Accept rule), `phase-14-request-attachments.md` (the retention source), and R-08-36's row in `docs/security/phase-08-residual-risks.md`.
   - **Not added:** renamed labels, a custom matrix, a disposal job, reminder or ageing settings, dual control for changes.
3. **`docs/contract-gaps/phase-22-lists-risk-types-and-asset-owner.md`**
   - **The gap:** divisions and business units are free text (20 D-22); `CsrmRiskType` has no active flag (12 D-09); `CsrmInformationAsset` has no owner (UAT-053; Phase 10 D-37).
   - **The extension:** D-01 items 3 to 5, with D-18, D-19 and D-21's rules, and D-20's governance over `CsrmSavedView`.
   - **Dated amendments:** `phase-18-saved-views.md` (governance), `phase-06-administration-import-contract.md` (the asset owner and the active column), and Phase 20's suggestions read (its callers).
   - **Not added:** relations replacing the JDL strings, owners imported by name, codes or hierarchies beyond two levels.
4. **`docs/contract-gaps/phase-22-manual-start.md`**
   - **The gap:** nothing creates a questionnaire or an assessment draft without AI (G-20).
   - **The extension:** D-22 and D-23's operations, gates and recorded origin.
   - **Dated amendments:** `phase-06.8-questionnaire-governance-facts.md` and `phase-12-ai-run-record-and-provenance.md` (the manual origin), and `phase-21-stage-history.md` (the cause).
   - **Not added:** starting without AI by choice, any AI run or template content.

**Approval checkpoint:** the first plan writes all four records with their amendments, then a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews and approves each record, recording the approval in the record itself, and each record's schema, catalogue and specification work waits for its own approval, as Phase 17.1 did. The changes are additive, so Strapi's schema sync creates the tables and columns and `apps/backend/database/migrations/` stays empty (the 06.1 to 21 precedent). The proof boots a fresh test database: settings read their defaults, existing assets have no owner, every Risk Type is active, and earlier role assignments read "before {date}". The operator's development database shows the changes after the orchestrator's next Strapi start, and the content-type freeze check lists exactly the approved schema files.
</contract_gaps>

<authorisation>
## Authorisation Model and Negative Cases

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the Administration scope or the record rule, against the resolved IdamBox User in `ctx.state`, identically under the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2). Navigation visibility is not authorisation: every hidden control and gated page is also refused by Strapi.

**Grants (D-02):** reference reads and exports to `role.security_analyst` and `role.admin`; reference writes, configuration, lists management, Risk Type retirement, role holders, the change log and shared-view governance to `role.admin` only; the active lists through the Requestor birthright's form metadata; the manual start to the human Security Analyst, then the assigned-analyst rule. Nothing to `role.security_analyst_agent`.

**Positive cases:** the Admin manages and imports reference data, edits every setting and list, retires and reinstates Risk Types, governs shared views, and reads and exports role holders, the change log and reference lists, with usage as plain counts. A Security Analyst reads and exports reference data and its usage. The assigned analyst starts without AI under G-20's conditions. Every active user reads the active lists.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by Vitest or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| A Security Analyst (Bob) creates, edits, retires, reinstates or imports reference data, including import preview, templates and error reports | 403 (grant) | Read-only reference pages with no New, Import, Edit or Retire; the new, import and edit URLs show the permission state |
| Bob, Jane, Maya or the risk owner persona at any configuration, list management, role holders, change log or shared-view governance operation, or its export | 403 | The permission state at every Admin URL (SC4) |
| A first-line person at a canonical reference list or detail | 403, as today (the picker branches unchanged) | The permission state |
| The Admin at any analyst operation (queues, questionnaires, assessments, the register, reports and insights, assignment, generation, the manual start, risk and control edits, bulk edits, analyst exports) | 403 | The permission state at every analyst URL; no analyst navigation |
| The Admin named as assignee or peer approver | 409 `ASSIGNEE_NOT_ELIGIBLE` or `PEER_APPROVER_NOT_ELIGIBLE` (13 D-06; 17.1 D-13) | Never offered |
| The Admin at another person's request, questionnaire or assessment | 404, as any other Requestor | The not-found page |
| The service identity at any route its explicit grants reached | 403 (D-09) | Not applicable |
| A setting write with a stale version, an invalid value or no reason | 409 `CONFIGURATION_CHANGED`; 400 `CONFIGURATION_INVALID` naming each problem; 400 for the missing reason | The Admin's edits kept beside the newer values; errors beside their fields |
| A request create or update setting a division or unit not active on the list, or a unit outside its division | 400 `DIVISION_NOT_ON_LIST` or `BUSINESS_UNIT_NOT_ON_LIST` | Only active entries offered; units follow the division |
| Correcting a list label in use; moving a unit to another division | 409 `LIST_LABEL_IN_USE`; no operation exists | Retire and add offered instead |
| A risk create, update, bulk edit or import naming a retired Risk Type | 409 `RISK_TYPE_RETIRED` | Retired types not offered |
| Transferring a shared view to anyone but an active human Security Analyst | 409 `VIEW_OWNER_NOT_ELIGIBLE` | Only eligible analysts offered |
| A manual start by an analyst other than the assignee, by the analyst who raised the request, or with nobody assigned | 403 `NOT_ASSIGNED_ANALYST`; 403 `OWN_REQUEST`; 409 `REQUEST_UNASSIGNED` (13) | No start control; the panel names who can start |
| A manual start while generation is allowed with no failed run, while a job runs, or once the record exists | 409 `MANUAL_START_NOT_AVAILABLE` with the reason | Generate offered instead |
| Any role assignment, account change or user write through CSRM's API | No route (08 D-36) | No control; the page says where roles are assigned |
| Any write to the settings or the change log outside D-03's operations | No route | Not applicable |
| No identity, or no token | The matrix conventions | The sign-in path |

The `admin` matrix caller states its outcome on every route, including those of earlier phases (D-27).
</authorisation>

<seams>
## Cross-Phase Seams

Seams from `stage2-rules.md` that touch this phase:
- **Phase 22 (stage2-rules):** decision 8's authority and intervals and decision 17's threshold become the Admin's at the single points 12 D-10, 17.1 D-11 and 17.1 D-58 left, behind their getters (D-10, D-14, D-15); an open round keeps the configuration it opened under (D-11).
- **G-16:** not touched; no due logic here.
- **G-13:** not touched; "Retired" and "Not on the list" are reference states shown as neutral tags, not request statuses.
- **Phase 13's assignee:** the manual start is the assignee's act (D-22); the Admin is never eligible (13 D-06).
- **Phase 19's exports:** role holders and the change log export through Phase 19's module and its log (19 D-05 to D-11, D-17, D-18); reference exports stay readable by analysts and the Admin; the record-read check is not used.
- **Phase 14's attachments and the security event log:** the retention source (D-17), the inclusion refusal's copy (D-23), and export lines through 19 D-18.
- **Phase 17's fixtures:** no new first-line persona; the Admin persona takes `…5e05`, with the realm user, changed together (D-26).
- **Phase 18's bulk edits:** they validate against the current scale and the active Risk Types, and the acceptance-round lock is unchanged.
- **Phase 21:** the manual start calls the stage recorder (21 D-07); the heat map follows the published scale (21 D-15); the Admin gets no metrics (21 D-25).
- **The post-demo journey:** no slice; it stays green under the defaults.

Other seams:
- **Phase 10:** the control search stays the analysts' (D-29); the system owner's display is the asset owner's pattern (D-37); the title load precedes create-only seeds (D-36).
- **Phase 11:** the profile data and its Admin seam (D-06, D-13); Home's choice (D-16).
- **Phase 12:** the active library (D-09); the scale module (D-10, D-11); the policy module and refusal copy (D-26 to D-31, UI-D24); the role review (D-33).
- **Phases 15 and 16:** the narrowed Accept rule (16 D-38); proposals on manually started records.
- **Phase 17.1:** the round snapshot; readiness items after a change; the participant projection's authority and treatment expectation.
- **Phase 19.1:** notification retention unchanged (D-34); the Admin reads their own notifications; D-07's predicate.
- **Phase 20:** decision reviews renew under the current appetite (D-17); filters keep legacy values (D-22); views under governance (D-23); usage for the Admin (D-24); the reminder policy stays in code (D-26).
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/workstreams/csrm/uat/product-gaps/FINDINGS.md`: UAT-061 in full, and UAT-053 for the asset owner.
- `.planning/workstreams/csrm/uat/product-gaps/REPORT.md`: §5 (Reference data in the sidebar), §8's Phase 22 entry and §9 decision 1.
- `.planning/workstreams/csrm/POST-DEMO-BRIEF.md`: §1 and §2 (overrides, dev-mode rules).

### Planning authority
- `.planning/workstreams/csrm/ROADMAP.md`: the Phase 22 entry (goal, both "Carried" lines, decisions, contract line, four success criteria), and the 12, 14, 17.1, 18, 19.1, 20 and 21 entries for the seams.
- `.planning/workstreams/csrm/REQUIREMENTS.md`: ADMIN-07 and ADMIN-08; ADMIN-05's remainder; ASSESS-08, ASSESS-14, ASSESS-18, ASSESS-20, INT-05 and COLLAB-02 for the values this phase makes configurable.
- `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md`: decisions 1, 2, 8, 9, 12, 14, 15 and 17 with their notes; G-1, G-3, G-4, G-6, G-7, G-14, G-17 and G-20.
- `.planning/workstreams/csrm/STATE.md`: Decisions; "Risks and Open Decisions" (INT-02; R-08-36).
- `.planning/workstreams/csrm/phases/08-production-integration-and-hardening/08-CONTEXT.md` (D-36, D-44: the IAM routes stay unmounted).
- `.planning/workstreams/csrm/phases/10-existing-flow-gap-closure/10-CONTEXT.md` (D-28, D-29, D-36, D-37, and the asset owner deferral).
- `.planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-06, D-08, D-13, D-16).
- `.planning/workstreams/csrm/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md` (D-09 to D-11, D-20, D-21, D-23, D-26 to D-33, both Orchestrator Confirmations), `12-UI-SPEC.md` (UI-D24), and plans `12-02-PLAN.md` and `12-07-PLAN.md`.
- `.planning/workstreams/csrm/phases/13-request-pick-up-and-notes/13-CONTEXT.md` (D-06, D-10, the Phase 22 seam).
- `.planning/workstreams/csrm/phases/14-request-attachments/14-CONTEXT.md` (D-08, D-22, the Phase 22 seam) and `14-03-PLAN.md`.
- `.planning/workstreams/csrm/phases/17-mitigation-response-and-residual-reassessment/17-CONTEXT.md` (D-25, D-67, D-75).
- `.planning/workstreams/csrm/phases/17.1-review-peer-approval-and-risk-acceptance/17.1-CONTEXT.md` (D-11, D-13, D-17, D-19, D-26 to D-36, D-43, D-58, D-61, the Phase 22 seam) and `17.1-RESEARCH.md` ("The Configuration Points").
- `.planning/workstreams/csrm/phases/18-risk-table-and-spreadsheet-interoperability/18-CONTEXT.md` (D-09, D-20 to D-23, the Phase 22 seam).
- `.planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-CONTEXT.md` (D-05 to D-13, D-17, D-18, the Phase 22 seam and its deferred importable relations).
- `.planning/workstreams/csrm/phases/19.1-in-app-notification-centre/19.1-CONTEXT.md` (D-07, D-34, the Phase 22 seam).
- `.planning/workstreams/csrm/phases/20-oversight-registers-and-post-release-tracking/20-CONTEXT.md` (D-17, D-22 to D-26, the Phase 22 seam).
- `.planning/workstreams/csrm/phases/21-management-dashboards-and-metrics/21-CONTEXT.md` (D-07, D-08, D-15, D-25).

### Product, domain and contract
- `AGENTS.md` and `CONTEXT.md` (repository root).
- `docs/CSRM-PROJECT-BRIEF.md`: "Administration" and "Security Analyst Library and Inventory Management" (reversed in part by decision 1).
- `docs/references/idambox-datamodel.jdl`: `IdamBoxUser`, `Role`, `CsrmAssessmentRequest` (`division`, `businessUnit` as strings), `CsrmInformationAsset` (no owner), `CsrmInformationSystem.owner`, `CsrmRiskType`.
- `docs/references/specification.json` and `docs/references/served-operations.json` (the Administration operations, form metadata, `/v1/me/access`).
- Both catalogue copies: `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` (three roles today; the eight Administration Functions).
- `docs/contract-gaps/phase-06-administration-import-contract.md`, `phase-06.1-revert-audit-facts.md` (format), `phase-06.8-questionnaire-governance-facts.md`, and, once written, the Phase 12, 14, 17.1, 18, 19, 20 and 21 records named in `<contract_gaps>`.
- `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md` (the document middleware pattern), `0003-production-only-keycloak-oidc-sign-in.md`, `0004-strapi-verifies-keycloak-access-tokens.md` (fixture subjects, `/v1/me/access`, capabilities).
- `docs/security/phase-08-residual-risks.md`: R-08-36.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §3.6 risk severity; §4 Forms, DataTable, Dialogs, Toasts, Record links, Status badges, Empty states and Skeletons; §5 Motion; §6 Do-not list; extensions X-2, X-10, X-13, X-14, X-27, X-29, X-30, X-65 and X-67.

### External
- ISO/IEC 27005:2022 (risk criteria and acceptance criteria); ISO/IEC 27001:2022 clauses 6.1.2 and 6.1.3, and Annex A 5.3, 5.15, 5.18 and 8.32; the Three Lines Model (IIA, 2020); WCAG 2.2 AA.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-administration/`: the 24 Administration routes (`routes/csrm-administration.ts`, with `requireAnalystAdministrationScope` and the picker policies), `operations.ts`, and the query, repository, workflow and CSV import services.
- `apps/backend/src/policies/csrm-authorization.ts`: `HUMAN_ANALYST_ONLY_OPERATIONS`, `hasHumanAnalystOperation`, `loadEffectiveGrants` (the Requestor birthright plus explicit roles) and the Administration scope branch to generalise; `apps/backend/src/api/csrm-current-user/services/effective-access.ts` (`/v1/me/access`).
- `apps/backend/src/keycloak/register-idambox-user-provisioning.ts`: the document middleware pattern (`strapi.documents.use`, one transaction) for D-08; `development-fixture-subjects.ts` and `idp/keycloak/import/idambox-realm.json` (two fixed ids today; Phases 17 and 17.1 add `…5e03` and `…5e04`).
- `apps/backend/src/middlewares/csrm-development-identity.ts`: the development identity by email.
- `apps/backend/src/bootstrap/seed-csrm-data.ts`: the catalogue, role and function reconciliation, the control reconciliation (`controlNeedsUpdate`) to make create-only, and the fixture users; `seed-request-details.ts` holds the division and unit values for the list fixture.
- `apps/backend/config/ai.ts` and `apps/backend/.env.example` (12-02 adds the ceiling).
- Planned by earlier phases: `risk-scale.ts` with the appetite and its getter (12-02; 17.1), `review-policy.ts` (17.1), `csrm/ai/data-policy.ts` (12-02), the attachment policy (14-03), `CsrmSavedView` (18), the round entity (17), the suggestions read and usage reads (20), the export module and its log (19), the eligible-person predicate (19.1 D-07), the stage recorder (21).
- Web: `apps/csrm/src/features/administration/` (config, form, workspace, CSV import flow, service, actions); routes `apps/csrm/app/(app)/app/admin/[collection]/` (list, new, import, detail), each gated today by `administration:manage`; `apps/csrm/src/lib/capabilities/` (`capability-adapter.ts`, `strapi-capabilities.ts` anchors, `development-capabilities.ts`); `apps/csrm/src/lib/auth/session-adapter.ts` (`developmentRoles`) and `development-session-adapter.ts`; `apps/csrm/src/components/shell/role-switcher.tsx`; `apps/csrm/src/config/navigation/navigation.ts` (the Administration items); `apps/csrm/src/features/requests/request-form.tsx` (division and business unit as text fields today); `apps/csrm/src/features/assessments/owner-combobox.tsx` (the owner picker).

### Established Patterns
- Closed allowlist DTOs, natural keys and Phase 19's import and export flows for reference data (the 06 record).
- One configuration point per value, read through a getter, with code defaults and no environment variable (17.1 D-11, D-58; 20 D-26).
- Append-only history that no gate reads, recorded from deployment (16 D-18, D-19; 21 D-08).
- Moving FunctionAPIs between Functions with names, URLs and descriptions unchanged (07; 19 D-13).
- Matrix callers with Requestor-shaped default helpers (17 D-75).
- Fixture people changed together with their Keycloak subjects and realm users (ADR 0004; 17 D-67; 17.1 D-61).

### Integration Points
- **Strapi:** the catalogue copies and the seed; the policy and `/v1/me/access`; the Administration API; the configuration getters; the request workflow; the submission and round services; the generation operations and the job panels' read; new setting, change-log and list types.
- **Web:** the navigation profiles and capabilities; the `/app/admin/` routes; the request form; the job panels; the risk editor and table through the published scale.
- **Tests:** the matrix and harness, the integration suites, Vitest beside each module, the phase spec, and `administration-workflow.spec.ts`.
</code_context>

<specifics>
## Specific Ideas

- **The appetite change.** The risk committee decides that High risks are reviewed every 3 months, not 6. The Admin opens Configuration, then Risk appetite, sets High to 3 months, enters "Risk Committee 2026-10-01, minute 4.2" as the reason, and confirms a dialog showing 6 → 3 and saying it applies from the next submission. Bob's assessment in acceptance round 2 is unaffected; his next submission records the new interval, and its High decision takes a review date 3 months out. The change log shows the Admin, the time, 6 and 3, and the minute reference.
- **The access review.** The Admin filters role holders to explicit roles and exports the XLSX for the quarterly recertification. One row reads "Inactive, still holds Security Analyst"; the identity platform's administrator removes the role, and the change log records the removal, its origin and the operator.
- **The refused request.** A Restricted vendor request meets a ceiling the Admin set at Internal. Bob, the assignee, sees why generation is refused and "Start without AI", confirms, and adds questions by hand. The questionnaire records that it started without AI, and Jane's view says a Security Analyst prepared it.
- **Read, not write.** Bob opens Controls, searches for 5.23, and reads and exports it; there is no Edit. Opening `/app/admin/controls/new` shows him the permission state, and the API refuses his PATCH.
</specifics>

<deferred>
## Deferred Ideas

- Renaming scale levels or bands (with aliases for stored values), a custom matrix, and changing the impact areas.
- Configurable assessment types and business criticality (JDL enums).
- Admin-configurable reminder timings (20 D-26) and ageing bands or a working-week calendar (21 D-12).
- A disposal job with legal hold and purge on request; a shorter retention for read notifications.
- Maker-checker (dual control) for configuration changes; notifying analysts of a configuration change.
- A read-only "risk criteria" page for every user.
- Starting without AI by choice while generation is available; an "AI off" switch.
- Auto-assignment on an analyst's first action (13's candidate); a decider-chosen earlier review date (17.1's candidate).
- Owners imported by name for systems and assets, and Risk Type controls imported by number (19's deferral).
- Breakdowns by division and business unit in reports (20, 21).
- Role assignment in CSRM with dual control and audit (decision 1; ADMIN-08 criterion 2).
- Retiring controls, systems or assets.
</deferred>

## Seeds Confirmed or Corrected

- **ADMIN-07 and ADMIN-08; closes UAT-061; decision 1:** confirmed (`<requirements>`, D-02, D-05 to D-08).
- **A new IdamBox Role in both catalogue copies with re-granted Administration functions; a development sign-in fixture consistent with ADR 0004's fixture subjects and the realm import, without starting Keycloak; no role assignment in CSRM:** confirmed. **Precisions:** the re-grant splits each Administration Function's reads (both roles) from its writes (moved into Admin-only Functions), and the policy's Administration scope is generalised (D-02); the persona takes `…5e05` (D-26). **Added:** an `admin` matrix caller on every route (D-27), and the conclusion of the service agent's role review that 12 D-33 deferred here (D-09).
- **The configuration taken over:**
  - **Confirmed:** the scales (descriptions) and rating bands (D-13); the appetite with its authority and intervals, plus decision 8's "treatment is required" as a flag (D-14); the peer-review threshold (D-15); the active Risk Types (D-18); the AI data policy and ceiling with the `.example` bootstrap, plus 12 D-26's unclassified default (D-16); divisions and business units as a two-level list (D-19); shared register views as governance, with sharing still the owner's (D-20).
  - **Corrected:** the scale and band labels stay fixed (D-13); decision 8's AI Accept limit is not an Admin setting, and the appetite only narrows it (D-14; 17.1-RESEARCH).
  - **Not taken over:** 20 D-26's reminder policy and 21's ageing bands (seven days and the bands are fixed by G-18, NOTIFY-02 and REPORT.md §4).
- **Carried items:** the Information Asset owner, confirmed (D-21, record 3); the manual start, confirmed, with "unavailable" read as a failed or interrupted latest run and the start reserved to the assigned analyst (D-22, D-23); the attachment retention, confirmed as the records retention rule with no disposal job (D-17); the shorter retention for read notifications, declined (D-17).
- **Contract-gap records before an approval checkpoint; settings apply forward and never rewrite recorded decisions:** confirmed, as four records and one checkpoint (`<contract_gaps>`). **Precision:** an open acceptance round keeps the configuration it opened under, by a snapshot on the round (D-11), answering 17.1-RESEARCH's open question.
- **Direct URLs to Admin screens show the permission state; a Security Analyst without the Admin role reads but cannot change reference data:** confirmed (D-06, D-24). **Added:** the Admin gets the permission state at analyst URLs; usage shows to the Admin as plain counts; seeds stop overwriting Admin-owned reference data (D-06); reference data changes join the change log (D-12); role changes made in the identity records are recorded (D-08).

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The research raised three questions and one residual. Each is settled as follows and binds the plans:

- **Context too large:** a request whose AI context exceeds the bound counts as generation "unavailable" (D-22), so the manual start (G-20) is offered, although no run was recorded.
- **The manual questionnaire's title** defaults on the server from the request, so the manual-start confirmation needs no title field.
- **"Review complete" in D-22** means the same eligibility check that generation uses. No new stored fact is added.
- **Hidden content types:** `visible: false` on the four new types removes their admin-panel write permissions. Reading by direct URL remains, and a Phase 22 plan task records it as a residual in `docs/security/phase-08-residual-risks.md`.
- **The Admin development fixture** (`...5e05`) stays consistent with the realm import, provided the realm user carries no realm role. The OIDC tests stay green, without starting Keycloak.


## Carried from Phase 16 (2026-10-16, pilot ruling): a limit on concurrent AI provider calls (BE2-13)

The Phase 16 code review (`.planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/16-REVIEW.md` and `16-REVIEW-DISPOSITION.md`, BE2-13) found that the proposal job registry is single-flight per key only: one assessment can run a suggestions job and one rewrite per active Risk at once, up to the 100-run cap, each a provider call, so cost and provider rate limits are unbounded within a process. Phase 16's threat model (T-16-27) asked only for single flight and the run cap. The pilot routed a per-process (or per-configuration) limit on concurrent provider calls here, beside this phase's other configuration points (S-13): one configurable bound around the registry's `execute`.

## Carried from Phase 19 (2026-10-17, pilot rulings): two export and grant items (BE1-09, BE2-07)

The Phase 19 code review (`.planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-REVIEW.md` and `19-REVIEW-DISPOSITION.md`) routed two items here:

- **BE1-09:** a questionnaire export with a `status` filter (`apps/backend/src/csrm/exports/export-views.ts`, the questionnaire view's `count`) loads every questionnaire in the analyst's scope, with its questions, before the 10,000-row cap is checked, because a questionnaire's status is computed in memory. The cap bounds the file, not the memory of an over-cap attempt. Read `documents().count(...)` first and refuse when that upper bound already exceeds the cap, loading and counting exactly only within it; or bound the in-memory status read, beside this phase's other configuration and hardening points.
- **BE2-07:** after 19-09 moved the report FunctionApis, `function.reports.reports` holds no FunctionApi but keeps `menuPath: "Reports:Reports"` and its grant to `role.security_analyst_agent`, so the agent's `/v1/me/access` lists an empty Reports menu Function. It is not a hole (navigation is not authorisation). When this phase withdraws the agent's explicit grants (D-09), drop that grant, and update the seed test that pins the empty Function (`apps/backend/tests/analyst-insight-catalogue-seed.integration.test.ts`).

## Carried from Phase 19 (security audit) (2026-10-17, pilot ruling): an export rate and concurrency limit

The Phase 19 security audit (`.planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-SECURITY.md`, "Notes") found that the 14 export operations have no per-actor rate or concurrency limit, and that Strapi puts no byte bound on a built file (the web's 64 MiB check runs only after Strapi has built it). Each export is bounded by its 10,000-row cap, its 40 columns and its stored fields' own lengths, and no Phase 19 plan asked for a rate limit. The pilot routed the limit here, beside Phase 16's BE2-13 limit on concurrent provider calls (the section above) and this phase's other configuration points (S-13): one configurable per-actor (or per-process) bound around the export pipeline (`apps/backend/src/csrm/exports/run-export.ts`), and a byte bound on the built file before it is sent.

---

*Phase: 22-admin-role-and-configurable-lists*
*Context gathered: 2026-10-01*
