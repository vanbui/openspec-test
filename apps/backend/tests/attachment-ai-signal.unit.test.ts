import assert from "node:assert/strict";
import test from "node:test";

import { changedAttachmentInputs } from "../src/api/csrm-request-attachment/services/attachment-ai-signal";

/*
 * Phase 14 D-36 (14-UI-SPEC §6.2): the files half of "AI inputs changed since the last generation". Against the target's
 * baseline run, a file in the AI inputs now that the run did not include is "included", and a file the run included that is
 * not in the inputs now is "removed" when it has been removed, else "excluded". Against the generation date of a record
 * generated before run records existed, a file in the inputs whose text was extracted after it is "included", and nothing
 * reads "excluded" (what such a generation included is not recorded). With no baseline, no file is read or listed.
 */

const REQUEST = "request-1";
const GENERATED = "2026-10-01T00:00:00.000Z";

type Row = Record<string, unknown>;

/** A stored file: in the AI inputs unless a case says otherwise, uploaded on day `day` of September. */
function file(id: string, day: number, extra: Row = {}): Row {
  return {
    documentId: id,
    fileName: `${id}.pdf`,
    uploadedAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    scanStatus: "clean",
    removedAt: null,
    aiTextIncluded: true,
    aiTextFacts: { available: 10, kept: 10, truncated: false, extractor: "csrm-extract-1", extractedAt: "2026-09-30T00:00:00.000Z" },
    ...extra,
  };
}

const excluded = { aiTextIncluded: false, aiTextFacts: null };
const removed = { removedAt: "2026-10-02T00:00:00.000Z", aiTextIncluded: false, aiTextFacts: null };

/** A Document Service double holding the request's stored files, in upload order, recording every read. */
function fakeStrapi(rows: Row[]) {
  const reads: Row[] = [];
  const strapi = {
    documents: (uid: string) => ({
      findMany: async (query: Row) => {
        if (uid !== "api::csrm-request-attachment.csrm-request-attachment") return [];
        reads.push(query);
        return rows;
      },
    }),
  };
  return { strapi, reads };
}

test("against a run: a file included since is included, an included file since removed is removed, in upload order (D-36)", async () => {
  const { strapi, reads } = fakeStrapi([file("a", 1), file("b", 2, removed), file("c", 3)]);
  const changed = await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: ["a", "b"] } });
  assert.deepEqual(changed, [
    { documentId: "b", fileName: "b.pdf", change: "removed" },
    { documentId: "c", fileName: "c.pdf", change: "included" },
  ]);
  // One read, of this request's stored files only, in upload order.
  assert.equal(reads.length, 1, "FILES_READ_COUNT");
  assert.deepEqual(reads[0]?.filters, { assessmentRequest: { documentId: { $eq: REQUEST } } }, "FILES_READ_FILTER");
  assert.deepEqual(reads[0]?.sort, ["uploadedAt:asc", "id:asc"], "FILES_READ_ORDER");
  assert.ok(!(reads[0]?.fields as string[]).includes("aiText"), "FILES_READ_THE_TEXT");
});

test("against a run: an included file excluded since, rather than removed, is excluded", async () => {
  const { strapi } = fakeStrapi([file("a", 1), file("b", 2, excluded), file("c", 3)]);
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: ["a", "b"] } }), [
    { documentId: "b", fileName: "b.pdf", change: "excluded" },
    { documentId: "c", fileName: "c.pdf", change: "included" },
  ]);
});

test("against a run: a file the context loader would not send is not in the inputs, whatever its inclusion says", async () => {
  // Included before, and still marked included, but no longer clean: the loader no longer sends it.
  const { strapi } = fakeStrapi([file("a", 1, { scanStatus: "pending" }), file("b", 2, { scanStatus: "blocked" })]);
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: ["a"] } }), [
    { documentId: "a", fileName: "a.pdf", change: "excluded" },
  ]);
});

test("against a run that included exactly the files in the inputs now, nothing changed; a file the run named that is gone is not listed", async () => {
  const { strapi } = fakeStrapi([file("a", 1), file("b", 2, excluded)]);
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: ["a"] } }), []);
  // A file whose record is not on this request cannot be named or linked, so it is not listed.
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: ["a", "gone"] } }), []);
});

test("against a generation date: only files in the inputs whose text was extracted after it are included, and none excluded", async () => {
  const extractedAt = (at: unknown) => ({ aiTextFacts: { available: 10, kept: 10, truncated: false, extractor: "csrm-extract-1", extractedAt: at } });
  const { strapi } = fakeStrapi([
    file("before", 1, extractedAt("2026-09-30T00:00:00.000Z")),
    file("after", 2, extractedAt("2026-10-02T00:00:00.000Z")),
    file("at", 3, extractedAt(GENERATED)),
    file("unreadable", 4, extractedAt("not a date")),
    file("excluded", 5, excluded),
    file("removed", 6, removed),
  ]);
  // A fact that cannot say when the text was extracted fails visible: it counts as changed, as Phase 13's notes do.
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "generated", generatedAt: GENERATED } }), [
    { documentId: "after", fileName: "after.pdf", change: "included" },
    { documentId: "unreadable", fileName: "unreadable.pdf", change: "included" },
  ]);
  // A generation date that cannot be read cannot clear any file, so every file in the inputs shows.
  assert.deepEqual(
    (await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "generated", generatedAt: "not a date" } })).map((entry) => entry.documentId),
    ["before", "after", "at", "unreadable"],
  );
});

test("with no baseline, no file is read and none is listed", async () => {
  const { strapi, reads } = fakeStrapi([file("a", 1)]);
  assert.deepEqual(await changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: null }), []);
  assert.equal(reads.length, 0, "NO_BASELINE_READ_FILES");
});

test("a stored file the signal cannot name fails the signal, never drops out of it (fail visible)", async () => {
  for (const [label, malformed] of [
    ["NO_DOCUMENT_ID", file("x", 2, { documentId: null })],
    ["NO_FILE_NAME", file("x", 2, { fileName: "" })],
  ] as const) {
    const { strapi } = fakeStrapi([file("a", 1), malformed]);
    await assert.rejects(changedAttachmentInputs({ strapi, requestId: REQUEST, baseline: { kind: "run", includedIds: [] } }), /^Error: CSRM request attachment is invalid\.$/, `${label}_DROPPED_SILENTLY`);
  }
});
