# Phase 13 Deferred Items

## From 13-16 (notes in the AI context)

- **The web reads CONTEXT_TOO_LARGE with Phase 12's administrator copy.** Since 13-16, Strapi's job failure message for
  CONTEXT_TOO_LARGE names the notes marked as changing the AI inputs when any are marked ("The AI context is too large.
  51 notes are marked as changing the AI inputs (notes 1 to 51); unmark some and try again."). The questionnaire and
  draft job cards (`apps/csrm/src/features/assessments/questionnaire-generation-job.tsx`,
  `assessment-draft-job.tsx`) read the code through `aiJobFailureCopy` (`ai-assistance-domain.ts`) first, which shows
  "This request holds more information than CSRM can send to the AI at once, so nothing was sent. Contact your
  administrator." and so never shows the served message. 13-UI-SPEC.md gives no copy for this refusal and no Phase 13
  plan owns it, so 13-16 left the web unchanged (copy comes only from the UI-SPEC). A later UI-SPEC change should give
  the analyst the notes-aware sentence, or let the card show the served message for this code when notes are marked.
  Severity: low (the refusal is safe and nothing is sent; the analyst is pointed at an administrator rather than at the
  marks they can change).

## From the UI review disposition (2026-10-10, UI-06)

- **An IdamBox User saved with an empty display name shows as a blank name outside the assignment block.** Strapi's
  `required` on `displayName` refuses only a missing value, and `projectPerson`
  (`apps/backend/src/api/csrm-assessment-request/services/request-people.ts`) serves a missing name as an empty string.
  UI-06 made the assignment domain (status line, history and every toast) read `a Security Analyst` for it. The hub's
  `Assigned to` / `Security Analyst` row (`request-hub.tsx` `holderRow`), the queues' and My requests' holder cells and
  the Requestor's Home lines still print the empty name as given, as the hub's `Requestor` row did before this phase.
  The fix at source is a rule that refuses an empty display name for an IdamBox User (a minimum length on the
  attribute or a check in the user write), which is outside Phase 13's approved schema. Route: the v3.0 Identity
  Lifecycle milestone, whose one fixed mapping derives `displayName` from the names when a source sends none
  (`IDENTITY-LIFECYCLE-BRIEF.md` I20). The attribute rule changes the shared `IdamBoxUser` schema, so it needs its own
  contract-gap record naming every workstream that reads it. Severity: low (data quality; no person is misnamed, a
  name is missing).
