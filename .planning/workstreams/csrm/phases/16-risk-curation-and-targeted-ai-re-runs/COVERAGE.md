# API Coverage — OpenAI-compatible chat completions (risk proposals)

Full coverage: every capability of the provider surface that Phase 16's two AI operations (`risk-suggestions`, "Suggest more risks", and `risk-rewrite`, "Rewrite this risk") could use has a decision and a reason. Nothing is left undecided. The adapter is the Phase 06.7 chat-completions integration, reached through the closed risk proposal adapter (`apps/backend/src/csrm/ai/risk-proposals/openai-compatible-risk-proposal-provider.ts`); every suite pins the deterministic provider (D-50).

| capability | decision | reason |
| --- | --- | --- |
| chat.completions structured output (json_schema) | INTEGRATE | Both operations ask for one closed JSON object, which the adapter parses against a strict schema; the duplicate tiers, the Accept rule, the cap, the units and the focus then run on the parsed reply before anything is stored as a proposal. |
| streaming | OPT-OUT | The jobs are asynchronous and the closed adapter parses whole replies; partial text would never be shown or stored. |
| tool or function calling | OPT-OUT | Structured output suffices, and tools would widen the model's authority beyond proposing content that a Security Analyst decides (G-3). |
| embeddings | OPT-OUT | D-32 requires a deterministic lexical scorer for similarity with no new dependency. |
| batch | OPT-OUT | G-3 requires one human-initiated run per call; nothing is queued in bulk or run without an analyst asking. |
| moderation | OPT-OUT | Output is advisory and decided by a person before it reaches the assessment; inputs pass the AI data policy (the classification ceiling) before any call. |
| files or assistants | OPT-OUT | Attachments reach the context as extracted text through Phase 14; no file is uploaded to the provider and no stored assistant is used. |

## Notes

- The `pg` dependency in `apps/backend/package.json` and `pnpm-lock.yaml` arrived with the IAM merge `d1518c5f` (`PHASE_16_IAM_SYNC`). It is IAM-owned and is not a Phase 16 addition; Phase 16 adds no package (T-16-SC).
