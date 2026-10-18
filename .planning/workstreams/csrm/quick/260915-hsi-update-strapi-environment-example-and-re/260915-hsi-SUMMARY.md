---
quick_id: 260915-hsi
status: complete
---

# Strapi AI-provider configuration documentation summary

- Replaced the active AI example assignments with a fully commented, copyable
  local Ollama `qwen3.5:9b` template that preserves deterministic defaults.
- Added README instructions for installing Ollama, pulling the model, configuring
  the local Strapi environment, restarting Strapi, and safely using a SaaS
  OpenAI-compatible provider.

## Verification

- `git diff --check -- apps/strapi/.env.example README.md` passed.
- `Select-String` confirmed all `CSRM_AI_*` template assignments are commented
  and the README includes Ollama pull, copy-to-`.env`, restart, and SaaS guidance.

## Commit

- `1b45c7f` — `docs(quick): document Strapi AI provider configuration`
