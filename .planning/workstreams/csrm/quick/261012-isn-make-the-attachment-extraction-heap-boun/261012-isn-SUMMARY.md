---
quick_id: 261012-isn
status: complete
commit: f00725f
---

IN-306 (the pilot's ruling, 2026-10-12): the attachment-extraction heap limit now holds on every runtime. `runWorker`
in `apps/backend/src/csrm/files/extraction.ts` keeps `resourceLimits.maxOldGenerationSizeMb` and adds a parent-side
watchdog: every `HEAP_WATCH_INTERVAL_MS` (10 ms) it reads `worker.getHeapStatistics()` and, once `used_heap_size` passes
`heapMb`, terminates the worker; the reply is then null, so the answer is the same ATTACHMENT_TEXT_UNAVAILABLE as any
other overrun. A read waits for the previous one; a rejected read keeps watching until the worker exits; the exit
handler clears the watchdog with the wall-clock timer, so the observer's start/exit order and the wall clock are
unchanged. The installed `@types/node` (20.x) predates `getHeapStatistics`, so a local interface types the one call
(no dependency change); where the method is absent the watchdog does not start and `resourceLimits` alone apply.

Measurements on this Linux host (Node 24.19.0, three runs each, worker heap in use, polled every 5 ms):
- one-page PDF at 32 MB: peak 11.5 to 11.8 MB used (19 to 20 MB total), reads its text;
- 300-page probe PDF at 32 MB: peak 112.7 to 116.2 MB used (about 182 MB total), not stopped by `resourceLimits`;
- the same PDF at 768 MB: 116.8 MB used. Band between control and probe: 12 MB to 115 MB, with 32 MB inside it.

Validation:
- RED: `attachment-extraction.unit.test.ts` 41/42 at `84f0e66` (IN-306 fails with HEAP_OVERRUN_WAS_NOT_UNAVAILABLE); the
  test is unchanged.
- GREEN: 43/43, three consecutive runs (IN-306 plus a new focused test that no timer outlives a read file or an
  overrun).
- Every other test file importing `extraction.ts` (attachment-policy, attachment-ai-input, attachment-pdf-empty-password,
  attachment-content-check, assessment-context, request-attachments): 254/254.

GSD execution ran inline (no agent-spawning tool in this session); the STATE.md row was written on the workstream's
STATE path because `quick-tasks-append` writes the root STATE.md.
