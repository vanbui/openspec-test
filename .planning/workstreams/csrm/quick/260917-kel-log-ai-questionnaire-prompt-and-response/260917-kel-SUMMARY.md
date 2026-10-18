---
quick_id: 260917-kel
status: complete
---

# Questionnaire provider diagnostics and wire-contract summary

- Added a default-off server configuration flag for transcript diagnostics. When explicitly enabled, Strapi debug logs the outbound prompts and received assistant content with only the structured schema identifier; the logs exclude credentials, headers, provider endpoint data, and caught upstream bodies.
- Closed the OpenAI-compatible questionnaire wire contract at the adapter boundary: exactly schema version 1, 8–15 questions, bounded non-empty textual fields, six supported answer types, boolean required flags, and answer-type-correct choices.
- Expanded provider tests to assert the structured-output schema and prompt, valid adapter-owned key/order conversion, malformed-response rejection, and diagnostics default-off/explicit-on behavior.

## Verification

- `npm --prefix apps/strapi test -- --test-name-pattern="questionnaire provider"` passed.
- `npm --prefix apps/strapi run test` passed.
- Direct provider verification passed: 26/26 tests across questionnaire provider, guardrail, and failure suites.
- `git diff --check` passed before commit.

## Commit

- `3d03ae5` — `feat(quick-260917-kel): diagnose questionnaire provider output`

## Deviations

- Updated adjacent AI-provider test fixtures to use the new required 8-question minimum; this was necessary to keep the existing material workflow test suite valid under the newly enforced model wire contract.
