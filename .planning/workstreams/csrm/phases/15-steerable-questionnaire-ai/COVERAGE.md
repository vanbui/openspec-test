# API Coverage — OpenAI-compatible chat completions (Phase 15 operations)

Full coverage: every capability of the provider surface that Phase 15's two AI operations (questionnaire proposals, `questionnaire_proposals`, and the per-question rewrite, `question_rewrite`) could use has a decision and a reason. Nothing is left undecided. The rows are Phase 12's (`.planning/workstreams/csrm/phases/12-ai-context-suggestions-and-provenance/COVERAGE.md`), re-decided for these operations; the adapter is still the Phase 06.7 chat-completions integration, and every suite runs the deterministic providers (D-30).

| capability | decision | reason |
| --- | --- | --- |
| chat completion with strict JSON schema response format | INTEGRATE | Both operations ask for one closed JSON object (the proposal items, or the rewritten question) and the adapter parses it against a strict schema, then applies its drop rules, before anything is stored. |
| request timeout and safe failure taxonomy | INTEGRATE | A slow or failing provider ends the proposal job with a closed failure code (Q3's copy) and nothing partial is stored; a restart marks a running job interrupted. |
| reasoning effort and max output tokens settings | INTEGRATE | Operator-configured per operation and sent with each request, as for Phase 12's operations; the item and new-question caps are CSRM's own, enforced after parsing. |
| tool or function calling | OPT-OUT | D-05 stands: the model is given no tools; it only proposes items that a Security Analyst confirms, edits then confirms, or rejects. |
| streaming responses | OPT-OUT | Not needed: one closed JSON object is parsed whole, and the job reports its state, not partial text. |
| embeddings | OPT-OUT | Not needed: near-duplicate detection and source matching use CSRM's deterministic lexical scorer. |
| files, assistants, batch, fine-tuning, moderation, images and audio | OPT-OUT | Out of scope for both operations; the questionnaire, the marked notes and the included files' text are sent inline as data, never as files or stored assistants. |
