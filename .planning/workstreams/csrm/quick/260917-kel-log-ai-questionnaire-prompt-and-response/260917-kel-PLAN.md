---
quick_id: 260917-kel
status: planned
---

# Diagnose and validate OpenAI-compatible questionnaire generation

Make questionnaire-generation failures diagnosable in a deliberately enabled secure environment, while making the GPT-5.6-terra structured-output contract reject malformed model wire data at the adapter boundary before persistence is attempted.

## Tasks

1. **Add opt-in AI completion transcript diagnostics.**

   **Files:** `apps/strapi/config/ai.ts`, `apps/strapi/src/csrm/openai-compatible-client.ts`

   **Action:** Add a boolean AI diagnostic configuration value, disabled by default, and carry it through `CsrmAiOperationConfig`. When it is explicitly enabled, have `requestJsonCompletion` emit a structured Strapi debug log for the outbound system/user prompt and a separate structured debug log for the raw assistant content returned by the completion, including only the operation/schema identifier needed to correlate the pair. Capture the received content before JSON parsing so a malformed response remains diagnosable. Do not log the API key, Authorization header, complete HTTP request object, provider URL, or caught upstream error bodies; when diagnostics are disabled, emit neither prompt nor response content. Preserve the existing safe public failure mapping, including its non-disclosure of provider diagnostics.

   **Verify:** `npm --prefix apps/strapi test -- --test-name-pattern="questionnaire provider"`

   **Done:** Prompt and raw model response are available only through an explicit server-side diagnostic flag and Strapi debug logging; normal operation and returned job failures expose no credentials, request headers, endpoint details, or transcript text.

2. **Make the questionnaire model wire contract exact and prove GPT-style structured-output handling.**

   **Files:** `apps/strapi/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts`, `apps/strapi/tests/ai-provider-questionnaire.unit.test.ts`

   **Action:** Tighten the model-facing JSON schema, prompt contract, and `toQuestionnaireGenerationProposal` boundary together so the only accepted response is the required questionnaire wire form: schema version 1; non-empty bounded title/description/question/section text; the supported six answer types; boolean `required`; and a `choices` array whose semantics match the answer type. Enforce the requested 8–15 question range at the model boundary, require distinct usable choices for select types, and require no choices for non-select types rather than silently discarding model output. Keep generated question and section keys/orders adapter-owned, then continue through the existing closed questionnaire-definition parser as the final authority. Extend the fake-provider tests to assert the exact structured schema and prompt sent to the endpoint, successful conversion of a valid full wire response, rejection of each newly closed malformed case, and diagnostic logging’s default-off/explicit-on behavior without asserting or leaking credentials. Keep model output advisory: no change may create or release an assessment.

   **Verify:** `npm --prefix apps/strapi test -- --test-name-pattern="questionnaire provider"`

   **Done:** A GPT-5.6-terra-compatible request advertises one closed 8–15-question wire schema, and only a response that satisfies every required questionnaire field and choice rule reaches the existing definition parser; failing responses remain safe typed provider failures with opt-in diagnostic evidence available to operators.

## Completion checks

- `npm --prefix apps/strapi test -- --test-name-pattern="questionnaire provider"` passes.
- `npm --prefix apps/strapi run test` passes before commit.
- Review `git diff --check` and the changed log payloads to confirm no API key, Authorization value, endpoint URL, or safe job response contains diagnostic transcript data.
