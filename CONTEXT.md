# IdamBox Cyber Risk Manager (CSRM)

CSRM takes a Requestor's Assessment Request through a Questionnaire to a Risk Assessment that a Security Analyst reviews and releases. Domain terms come from `docs/references/idambox-datamodel.jdl`; this glossary records the product labels that differ from them.

## Language

**Released (Risk Assessment status)**:
The product label for a `CsrmAssessment` whose `assessmentStatus` holds the JDL value `approved` (`CsrmAssessmentStatus.APPROVED`): a Security Analyst has released it to the Requestor, and it is read-only.
_Avoid_: Approved (as the label of an assessment's status), Published

Only the displayed label changes. The stored value `approved`, the `status=approved` query value and the request-status label `Approved` (`CsrmRequestStatus`) are unchanged.
