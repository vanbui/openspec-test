# Questionnaire generation provenance

`CsrmQuestionnaire` now records optional `generatedDate` and `generatedBy` values when a contextual questionnaire is generated. They mirror the established `CsrmAssessment` vocabulary and meaning: the generation timestamp and the initiating analyst, respectively. Keeping both fields optional preserves the validity of existing questionnaires and manually created questionnaires.

The values are written in the transaction that creates or refreshes generated question rows, so the questionnaire and its question set share one durable provenance event. Responses that expose `generatedBy` populate the related user summary.

Provider name and provider version remain only in the bounded questionnaire-generation job record. They are available through the authorised job-status route for its retention period rather than being persisted on the questionnaire, matching the assessment-generation precedent.
