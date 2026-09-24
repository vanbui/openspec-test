---
quick_id: 260915-hsi
status: planned
---

# Strapi AI-provider configuration documentation

Preserve the existing uncommitted AI configuration addition and turn it into a safe, copyable local-Ollama template plus operator documentation for either a local or SaaS OpenAI-compatible LLM.

## Tasks

1. Update `apps/strapi/.env.example`, retaining the existing AI-variable edit as in-scope. Replace its active sample assignments with a clearly labelled, fully commented copyable block for local Ollama. The block must set `CSRM_AI_PROVIDER=openai-compatible`, the `http://127.0.0.1:11434/v1` assessment and questionnaire base URLs, blank API-key entries, `qwen3.5:9b` for both models, structured output enabled, and the existing 60,000 ms / 8,000 / 16,000 sensible limits. Keep default production-safe behaviour clear: copied values enable the real provider, while no uncommented configuration in the example changes the default deterministic provider.

2. Extend `README.md` immediately after the local Strapi configuration setup with a concise “AI generation with Ollama” guide: link or name the official Ollama installation route, run `ollama pull qwen3.5:9b`, copy the commented local block into the gitignored `apps/strapi/.env`, then restart Strapi. Explain that the two configured model operations are questionnaire generation and assessment-draft generation, and that the resulting draft remains advisory/reviewable. Add a separate SaaS OpenAI-compatible section instructing operators to set provider to `openai-compatible`, replace both base URLs and model names for the selected service, supply the service-issued API key(s) only in `.env`, and tune timeout, structured-output, reasoning-effort, and output-token settings when the provider requires it; do not include a real credential or imply that model output can release an assessment.

3. Verify documentation mechanically and by review: run `git diff --check -- apps/strapi/.env.example README.md`, then use `Select-String` to confirm the environment example contains only commented `CSRM_AI_*` template assignments and the README contains the `ollama pull qwen3.5:9b`, copy-to-`.env`, restart, and SaaS/OpenAI-compatible guidance. Review the rendered Markdown code blocks to ensure the local block is copyable after removing comment markers and no secret value is introduced. No application test suite is required because this task changes documentation/example configuration only.

## Done

- The example environment file contains a commented-out, copyable Ollama `qwen3.5:9b` block with the exact local OpenAI-compatible endpoint and blank keys, preserving the repository's deterministic default.
- The README gives complete local-Ollama setup and restart instructions and safely explains how to point both AI operations to a SaaS OpenAI-compatible provider.
- Whitespace checks pass and no credentials are committed.
