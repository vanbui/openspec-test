# Phase 06.7 — API Coverage Matrix

**Integration:** OpenAI-compatible Chat Completions wire protocol, consumed through the official `openai` npm package used as a thin HTTP client.
**Detector:** `api-coverage.cjs --json` against the phase PLAN set returned `detected: true`.
**Default rule:** every capability defaults to `INTEGRATE`. Every `OPT-OUT` carries a one-line reason.

## Capability surface

| Capability | Decision | Reason |
|---|---|---|
| `chat.completions.create` (non-streaming) | INTEGRATE | The single call both generation operations make. |
| Custom `baseURL` pointed at any OpenAI-compatible endpoint | INTEGRATE | The whole point of D-01/D-02: vendor-agnostic, self-hostable, no code change to repoint. |
| API key auth, including a blank/absent key | INTEGRATE | D-02 — some self-hosted servers reject an `Authorization` header entirely; the key is passed as an explicit string even when empty. |
| Per-request `timeout` | INTEGRATE | D-10 — explicit ~60s bound mapped to `PROVIDER_TIMEOUT`. |
| `max_tokens` output cap | INTEGRATE | D-10 — explicit cap sized to the parsers' own bounds, never the SDK/provider default. |
| `response_format: { type: "json_schema" }` structured output | INTEGRATE (toggleable, default on) | D-07 — a quality aid, not the trust boundary; disableable per deployment for backends that reject or ignore it. |
| Typed SDK error classes (`AuthenticationError`, `PermissionDeniedError`, `RateLimitError`, `APIConnectionTimeoutError`, `APIError`, `APIConnectionError`) | INTEGRATE | D-09 — these classes are exactly what makes the four-code taxonomy tractable and testable. |
| `defaultHeaders` on the client constructor | INTEGRATE (available, unused by default) | Reserved for the unresolved question of whether a keyless backend rejects an empty Bearer header; not exercised unless a real target requires it. |
| Streaming responses (`stream: true`) | OPT-OUT | CSRM polls a server-owned job registry; the analyst UI and job-lifecycle contract are explicitly unchanged this phase (D-11). Nothing consumes a token stream. |
| SDK internal retry (`maxRetries` > 0) | OPT-OUT (pinned to `0`) | D-11 — the job registry's `retry()` is the only retry. A second retry layer masks rate-limit and auth failures and multiplies egress per analyst click. |
| `client.chat.completions.parse()` + `zodResponseFormat()` | OPT-OUT | D-07 keeps the existing hand-rolled closed parsers as the unconditional gate; this helper needs Zod, and D-02 caps the phase at exactly one new dependency. |
| Tool / function calling (`tools`, `functions`, `tool_choice`) | OPT-OUT | D-08 layer 3 — the model is deliberately given no capability beyond emitting one JSON object, so a successful prompt injection has no escalation path. Asserted absent in Plan 06. |
| Assistants, Responses, Embeddings, Files, Images, Audio, Moderations, Batch, Fine-tuning, Vector Stores | OPT-OUT | Out of the phase boundary — scope is the two already-implemented generation operations. Self-hosted OpenAI-compatible backends generally do not implement these, so depending on them would break D-01's vendor-agnosticism. |
| Realtime / WebSocket APIs | OPT-OUT | No inbound provider channel exists; the job lifecycle is poll-based and unchanged (D-11). |
| Provider webhooks / callbacks | OPT-OUT | Would require a new inbound route and a new authorization surface; the phase adds no route (confirmed: no catalogue change needed). |
| `AzureOpenAI` vendor-specific client | OPT-OUT | Azure OpenAI serves the same Chat Completions wire format through a `baseURL`; a vendor-specific client would defeat D-01's protocol-level abstraction. |
| Native Anthropic / Bedrock / Vertex wire formats | OPT-OUT | D-01/D-02 — reachable by pointing `baseURL` at an operator-run translating gateway; CSRM code never needs to know a gateway is there. |
| Usage/cost accounting from the response `usage` field | OPT-OUT | No durable job or audit entity exists to record it; durable provider infrastructure and audit history remain Phase 8 (per `docs/contract-gaps/phase-04-deterministic-draft-jobs.md`, unchanged by this phase). |
| TLS verification bypass for self-hosted endpoints | OPT-OUT | D-02 — trusting a private CA is a deployment/OS concern configured through `NODE_EXTRA_CA_CERTS`, deliberately not an application setting. |

## Notes

- No opt-out above reduces a decision recorded in `06.7-CONTEXT.md`; each one is either explicitly chosen there (streaming, retry, Zod helper, tool calling, TLS bypass, native vendor formats) or falls outside the phase boundary stated in the same document.
- The `INTEGRATE` rows map onto Plans 06.7-01 (client construction, timeout, token cap, structured-output toggle, blank key), 06.7-02 (per-operation config and request-level vocabulary constraint) and 06.7-04 (the complete typed-error mapping).
