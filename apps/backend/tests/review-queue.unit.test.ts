import assert from "node:assert/strict";
import test from "node:test";

import { REVIEW_QUEUE_BUCKETS, selectReviewQueueBucket } from "../src/api/csrm-assessment-request/services/collection-scope";

function request(overrides: Record<string, unknown> = {}) {
  return {
    documentId: "request-1",
    requestStatus: "submitted",
    questionnaire: null,
    assessment: null,
    ...overrides,
  };
}

test("review queue buckets select only their published lifecycle slices", () => {
  assert.deepEqual(REVIEW_QUEUE_BUCKETS, ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"]);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => false), true);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => true), false);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ requestStatus: "draft" }), () => false), true);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ questionnaire: { releasedAt: "2026-09-21T00:00:00.000Z", questions: [] } }), () => false), true);
  assert.equal(selectReviewQueueBucket("generation-in-progress", request(), () => true), true);
  assert.equal(selectReviewQueueBucket("released", request({ requestStatus: "approved" }), () => false), true);
  assert.equal(selectReviewQueueBucket("released", request(), () => false), false);
});
