# API Coverage — OpenAI-compatible chat completions

Full coverage: every capability of the provider surface that Phase 12's two AI operations (questionnaire generation and the assessment draft) could use has a decision and a reason. Nothing is left undecided. The adapter is the Phase 06.7 chat-completions integration.

| capability | decision | reason |
| --- | --- | --- |
| chat completion with strict JSON schema response format | INTEGRATE | Both operations ask for one closed JSON object and parse it against a strict schema before anything is stored. |
| request timeout and safe failure taxonomy | INTEGRATE | A slow or failing provider ends the job with a closed failure code and a plain message; nothing partial is stored. |
| reasoning effort and max output tokens settings | INTEGRATE | Operator-configured per operation (`CSRM_AI_*_MAX_OUTPUT_TOKENS`, `CSRM_AI_REASONING_EFFORT`) and sent with each request. |
| tool or function calling | OPT-OUT | D-05: the model is given no tools; it only proposes content that a Security Analyst reviews. |
| streaming responses | OPT-OUT | Not needed: one closed JSON object is parsed whole, and the job reports progress, not partial text. |
| embeddings | OPT-OUT | Not needed: the deterministic lexical ranker selects risk types and control candidates (D-06, D-12). |
| files, assistants, batch, fine-tuning, moderation, images and audio | OPT-OUT | Explicitly out of scope for both operations; the request context is sent inline as data, never as files or stored assistants. |
