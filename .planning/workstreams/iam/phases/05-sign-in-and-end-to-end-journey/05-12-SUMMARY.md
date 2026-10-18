---
phase: 05-sign-in-and-end-to-end-journey
plan: "12"
status: blocked
updated: 2026-10-18
requirements-completed: []
---

# 05-12 summary: complete responsive journey and final evidence

**Outcome: every live stage passes; acceptance blocked by B1.** Record: [05-LIVE-EVIDENCE.md](05-LIVE-EVIDENCE.md).

- Task 1 (fresh-stack two-width gate): the official `--run` (run `iam-journey-3a51c9e6-…`, HEAD `e5964724`) passed all 29 live stages through the committed runtime: setup, both full lifecycles at 1440 and 375, and IN-03 with native recovery (519 s). The `evidence` stage then failed. Its unfiltered backend regression stops at the six inherited B1 compilation diagnostics, so the runner published no bundle, as designed.
- Task 2 (publication, cleanup, provenance): cleanup was verified (no owned containers, volumes, network, run directory or lock remained). No `journey.json`, screenshots or `evidence/journey/manifest.json` exist, so `--verify-evidence` has nothing to accept. `05-VALIDATION.md` was not changed, because no acceptance result exists.
- Live defects found and fixed: 15 runner/spec commits (`0ad8ab43` … `e5964724`), listed in 05-LIVE-EVIDENCE.md. They include one real gap in the runner's own environment: the owned listener never enabled CSRM routes. Two retry commits that only masked the task-read truncation were reverted by `113b2a29`. No backend source, schema, grant, catalogue, contract or committed default changed.
- Offline checks at `e5964724`: journey tests 224/224, `journey.mjs --check` passes, CSRM typecheck passes. CSRM unit suite outside the restricted executor: the first run had 1 failure out of 5412 (`assign-picker.test.tsx`, a csrm timing assertion on a 300 ms skeleton delay, under full-suite load). That file then passed 26/26 three times in isolation, and a full rerun passed 5412/5412 (222 files). The flake belongs to csrm and is untouched here.

Remaining for Phase 5: B1 closes (the csrm workstream lands its two modules on `main`, then `main` is merged here). Then one official rerun on a fresh run directory must publish and verify the journey bundle. Then SIGN-01/SIGN-02 close and phase verification follows.
