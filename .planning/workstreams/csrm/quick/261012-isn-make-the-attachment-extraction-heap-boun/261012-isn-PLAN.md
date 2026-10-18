---
quick_id: 261012-isn
slug: make-the-attachment-extraction-heap-boun
date: 2026-10-12
type: quick
ordered_by: pilot (IN-306 ruling, 2026-10-12)
files_modified:
  - apps/backend/src/csrm/files/extraction.ts
  - apps/backend/tests/attachment-extraction.unit.test.ts
---

# IN-306: make the attachment-extraction heap bound real on every runtime

## Why

On the Linux host a `worker_threads` Worker given `resourceLimits.maxOldGenerationSizeMb: 32` allocates well past it
without being stopped, so `runWorker` in `extraction.ts` does not bound extraction memory there, and the IN-306 unit
test (a 300-page PDF at 32 MB must be unavailable while a one-page PDF still extracts) fails.

## Ruling (pilot)

Keep `resourceLimits`. Add a parent-side watchdog as defence in depth: while the worker runs, poll its heap with
`worker.getHeapStatistics()` (Node 24) at a short interval; when `used_heap_size` exceeds `heapMb`, terminate it and
resolve the same unavailable result (null reply, so ATTACHMENT_TEXT_UNAVAILABLE). Observer start/exit order unchanged,
the watchdog cleared on every exit path, no change to the wall clock.

## Task 1 (TDD)

- RED: the existing IN-306 test fails on this host (41/42 in `attachment-extraction.unit.test.ts`). It is not changed.
- GREEN: in `runWorker`, a self-rescheduling poll (no overlapping reads) started after `onWorkerStart`, stopped in the
  `exit` handler alongside the wall-clock timer; a read that rejects (the worker already gone) is ignored.
- A focused unit test: an extraction that succeeds and one that overruns leave no timer behind.
- Verify: `attachment-extraction.unit.test.ts` green; the other test files importing `extraction.ts` green
  (attachment-policy, attachment-ai-input, attachment-pdf-empty-password, attachment-content-check,
  assessment-context, request-attachments).
- One atomic commit for code and test; docs commit for these records.
