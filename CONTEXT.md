# IdamBox Cyber Risk Manager (CSRM)

CSRM takes a Requestor's Assessment Request through a Questionnaire to a Risk Assessment that a Security Analyst reviews and releases. Domain terms come from `docs/references/idambox-datamodel.jdl`; this glossary records the product labels that differ from them.

## Language

**Released (Risk Assessment status)**:
The product label for a `CsrmAssessment` whose `assessmentStatus` holds the JDL value `approved` (`CsrmAssessmentStatus.APPROVED`): a Security Analyst has released it to the Requestor, and it is read-only.
_Avoid_: Approved (as the label of an assessment's status), Published

Only the displayed label changes. The stored value `approved` and the `status=approved` query value are unchanged, and a request whose stored status is `approved` (`CsrmRequestStatus`) also reads "Released".

**Released for response (Risk Assessment stage)**:
The stage in which a Security Analyst has shared an unreleased assessment with the Requestor and the nominated risk owners for their response, in numbered rounds (decision 3, G-12). It is not a release: nothing is final, and the analyst can still edit the assessment between rounds.
_Avoid_: Released (alone), Shared, Published

**Risk owner**:
The person named on a risk in `CsrmRisk.riskOwner`, who decides it: accepts it or approves its treatment. A Security Analyst nominates each risk's owner, and the nominated risk owners of an assessment are the distinct owners of its non-withdrawn risks (G-11). A risk owner needs only the Requestor birthright role, and reads the assessment because they are named on it. A Security Analyst may be named only when they take no analyst part in that assessment (G-11).
_Avoid_: Business owner, Sponsor (the request's `sponsor` is a different relation), Approver

**Executive approver**:
The person a Security Analyst names on a High or Critical risk, whose decision the risk appetite needs as well as the risk owner's, or for Critical risk instead of it (decision 8, G-14). The JDL has no name for this part; it is a person named on the record, not an IdamBox Role.
_Avoid_: Approver or Peer approver (a peer approval is a second Security Analyst's, decision 17), Sponsor, Delegate

**Accepted (exposure marker)**:
Phase 11 D-41's interim presentation of a released, open Risk whose recorded `CsrmTreatmentAction` is `ACCEPT`. Until Phase 17.1 supplies acceptance facts, this marker records the released treatment action, not a risk owner's decision. An unreleased proposal or a Risk with a closure date is never marked Accepted. Phase 17.1 refines the predicate with the acceptor, authority and review date.
_Avoid_: treating the interim marker as evidence of formal owner acceptance

**Submit final assessment**:
The Security Analyst's action that asks for acceptance. It opens an acceptance round in which each risk owner and executive approver decides their risks, and it locks the analyst's editing until the round is recalled, returned or ended by release (G-13). It releases nothing.
_Avoid_: Submit for approval (the catalogue's unserved `submit_for_approval` intent), Send for sign-off, Release

**Accept, Treat (risk decisions)**:
The two decisions a risk owner makes on a risk, stored in `treatmentAction` (`CsrmTreatmentAction`: `ACCEPT`, `TREAT`). Accept retains the risk, with a rationale; Treat commits to a treatment plan with a treatment owner and a resolve date (G-14). A value set before the owner decides is the analyst's recommendation, not a decision.
_Avoid_: Approve, Sign off, Decline (there is no per-risk decline: a disagreement is a contest point)

**Assigned analyst**:
The one Security Analyst accountable for an Assessment Request (decision 10, Phase 13): an active human analyst who did not raise the request (G-1), who picked it up from the queue or was assigned by another analyst, with every change recorded. Editing is not exclusive, but from Phase 17.1 only the assigned analyst marks the assessment reviewed, submits it for acceptance, recalls a round, and releases and closes (G-13).
_Avoid_: Owner (a risk owner decides risks, G-11), Handler

**Note (request)**:
An attributed, append-only plain-text message on an Assessment Request between its Requestor and the Security Analysts, from the request's first submission until its assessment is released (COLLAB-01, Phase 13). A Security Analyst can mark a note as changing the AI inputs, and only marked notes reach the AI, as untrusted text. Risk owners and other participants do not read notes: their channel is the contest point.
_Avoid_: Comment, Message, Contest point (a challenge to an assessment under acceptance)

**Attachment**:
A supporting file attached to an Assessment Request by its Requestor or a Security Analyst (CsrmRequestAttachment, COLLAB-02, Phase 14): added to the draft at intake or, after submission, with a note that says what it is; kept in private storage, downloadable only after its malware check passes, removed softly and on the record, and read by the AI only when a Security Analyst includes its text. Visible copy calls it a "file" (Files, Add files); "attachment" is the record and API term. Risk owners and other participants do not read attachments.
_Avoid_: Upload (the transfer, not the record), Document, Evidence (Phase 20's treatment evidence files)

**Confirm (AI proposal)**:
The Security Analyst's review of an AI-proposed value, risk, control or question: confirming makes it the analyst's own content, and the API records it as `accept` (Phase 12). Visible copy says "Confirm", never "Accept", because Accept is the risk owner's decision (G-14). The analyst's negative is "Dismiss" for a suggestion and "Reject" for a proposed change (decision 6).
_Avoid_: Accept, Approve (for an analyst's review of AI output)

**AI run**:
One recorded provider call for one AI operation (questionnaire generation or an assessment draft now; later phases add operations), with the Security Analyst who initiated it, the provider and model, a summary of what was sent (never the Requestor's own text), its outcome and the history of review decisions on what it proposed. It is stored as `CsrmAiRun`, the approved Phase 12 contract gap. A Requestor never sees one.
_Avoid_: Job (a generation job is the queued work that produces a run), Prompt log, Transcript

**AI proposal**:
An AI-written value or suggestion on a record, marked "AI proposed" until a Security Analyst confirms or edits it (see Confirm (AI proposal); the API's decision is `accept`). Confirming is the analyst's review, never the risk owner's Accept (see Accept, Treat). Release waits until every proposal on the assessment has been reviewed. On a questionnaire, an AI proposal can add, change or remove a question, and a Security Analyst confirms, edits then confirms, or rejects each one.
_Avoid_: AI decision, Recommendation (an analyst's recommendation is their own content)

**Information classification (request)**:
The highest recorded classification among the request's selected information assets (Public < Internal < Restricted < Critical Infrastructure Sensitive), or Internal when none is classified. The AI provider receives a request's information only when this is within the limit it is approved for (the ceiling the operator configures).
_Avoid_: Data classification (alone: a single asset's `dataClassification` is one input), Sensitivity, Security level

**Withdrawn (Risk)**:
A persisted, unreleased `CsrmRisk` that a Security Analyst has taken out of its assessment, recording who, when and why (decision 6, Phase 16). It keeps its number, fields and history, is read-only until a Security Analyst reinstates it with a reason, and counts nowhere: not in release readiness, figures, registers, or any Requestor or participant read. Only Security Analysts see it. No persisted risk is ever deleted.
_Avoid_: Deleted, Removed, Rejected (a rejected AI proposal is a different fact), Closed (a risk's closure after release is Phase 20's)

**Contest point**:
A participant's recorded challenge to one piece of an assessment under acceptance (an assessment field, a risk or one of its fields, or a control implementation), with a required reason, a reply thread and a status: open, answered, then resolved or withdrawn (G-15). Sending the assessment back with contest points reopens all of it for the Security Analyst. The JDL has no name for it.
_Avoid_: Comment, Note (a note belongs to a request, COLLAB-01), Dispute, Objection

**Closed (Assessment Request status)**:
The product label for a `CsrmAssessmentRequest` whose `requestStatus` holds the JDL value `closed` (`CsrmRequestStatus.CLOSED`): every risk of its assessment has a valid decision, and the assigned Security Analyst has released the assessment and closed the request in one step (G-13).
_Avoid_: Complete, Done, Resolved, Accepted

A request released before this flow keeps `approved`, which reads "Released" from Phase 11 (decision 16). A closed request's assessment stays `approved` and reads "Released"; the assessment's own `closed` status is unused.

## Identity lifecycle

**Identity Source**:
The customer's authoritative record of its workforce, typically the HR system, from which people are brought into IdamBox. An IdamBox User that came from one carries that source.
_Avoid_: HR feed, Source system, Hub (the identity engine is not an Identity Source)

**Identity engine**:
The IAM component (midPoint) that reads Identity Sources, decides each person's joiner, mover and leaver changes, and provisions IdamBox Users. It is not an Identity Source and not an IdamBox Role.
_Avoid_: Hub, Identity Source, IdP (Keycloak authenticates; it is not the identity engine)

**Identity**:
A person as the identity engine holds them, linking their Identity Source records to their IdamBox User.
_Avoid_: User, Account (when meaning the person across systems)

**IdamBox User**:
A person's (or a service's) record inside IdamBox (`IdamBoxUser`), which holds their status and IdamBox Roles. An Identity has at most one.
_Avoid_: Account (in product copy), Identity

**Sourced user, Manual user**:
An IdamBox User provisioned from an Identity Source, and one created inside IdamBox. A sourced user's identity attributes and status belong to its Identity Source and are read-only in IdamBox; its IdamBox Roles are always granted inside IdamBox. A manual user is never changed by an Identity Source.
_Avoid_: Synced user, Local user, Imported user
