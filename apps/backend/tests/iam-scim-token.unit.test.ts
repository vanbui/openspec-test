import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mock, test } from "node:test";
import type { Core } from "@strapi/strapi";
import type { Knex } from "knex";
import { administerSourceToken, hashSourceToken, parseSourceToken, verifySourceTokenDigest } from "../src/iam/scim/token-service";
import { withSourceLock } from "../src/iam/scim/source-lock";

const sourceDocumentId = "a".repeat(24);
const credential = () => `idb_scim_v1.${sourceDocumentId}.${randomBytes(32).toString("base64url")}`;

test("parses only the exact version, documentId and canonical 256-bit secret", () => {
  const token = credential();
  assert.deepEqual(parseSourceToken(token), { sourceDocumentId });
  for (const input of [null, undefined, 123, {}, "", ` ${token}`, `${token}\n`, token.toUpperCase(),
    token.replace("v1", "v2"), token.replace(sourceDocumentId, "a".repeat(23)),
    token.replace(sourceDocumentId, "a".repeat(25)), token.replace(sourceDocumentId, "-".repeat(24)),
    `${token}=`, `${token}.more`, token.slice(0, -1), `${token.slice(0, -1)}!`,
    `idb_scim_v1.${sourceDocumentId}.${"A".repeat(42)}B`]) {
    assert.equal(parseSourceToken(input), null);
  }
});

test("hashes the complete exact UTF-8 credential to a fixed SHA-256 digest", () => {
  const token = credential();
  const expected = `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
  assert.equal(hashSourceToken(token), expected);
  assert.match(hashSourceToken(token), /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(hashSourceToken(token), hashSourceToken(token.split(".")[2]));
});

test("only the whole exact token verifies; tampering and cross-source substitution fail", () => {
  const token = credential();
  const digest = hashSourceToken(token);
  assert.equal(verifySourceTokenDigest(token, digest), true);
  for (const input of [credential(), token.replace(sourceDocumentId, "b".repeat(24)), token.slice(11),
    ` ${token}`, `${token}\n`, token.toUpperCase(), token.replace("v1", "v2")]) {
    assert.equal(verifySourceTokenDigest(input, digest), false);
  }
});

test("absent or malformed stored digests never verify or throw", () => {
  const token = credential();
  for (const digest of [null, undefined, {}, 123, "", "0".repeat(64), `sha256:${"0".repeat(63)}`,
    `sha256:${"0".repeat(65)}`, `sha256:${"G".repeat(64)}`, `SHA256:${"0".repeat(64)}`,
    `${hashSourceToken(token)}\n`]) assert.equal(verifySourceTokenDigest(token, digest), false);
  assert.equal(verifySourceTokenDigest(null, hashSourceToken(token)), false);
});

test("missing source/hash still performs a timing-safe comparison of two 32-byte buffers", () => {
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const original = crypto.timingSafeEqual;
  let comparisons = 0;
  const comparison = mock.method(crypto, "timingSafeEqual", (left: NodeJS.ArrayBufferView, right: NodeJS.ArrayBufferView) => {
    assert.equal(left.byteLength, 32); assert.equal(right.byteLength, 32);
    comparisons++; return original(left, right);
  });
  try {
    for (const digest of [undefined, null, "malformed", hashSourceToken(credential())]) {
      assert.equal(verifySourceTokenDigest(credential(), digest), false);
    }
    assert.equal(comparisons, 4);
  } finally { comparison.mock.restore(); }
});

test("ambiguous and inexact names fail closed before a transaction", async () => {
  for (const rows of [[{ documentId: "a", name: "name" }, { documentId: "b", name: "name" }], [{ documentId: "a", name: "Name" }]]) {
    const host = { documents: () => ({ findOne: async () => null, findMany: async () => rows }) } as unknown as Core.Strapi;
    await assert.rejects(administerSourceToken(host, "name"), /IAM_SCIM_SOURCE_(AMBIGUOUS|NOT_FOUND)/);
  }
});

test("PostgreSQL locks the source row using runtime metadata before work", async () => {
  const calls: unknown[] = [];
  const query = {
    select(value: string) { calls.push(["select", value]); return query; },
    where(column: string, value: string) { calls.push(["where", column, value]); return query; },
    async forUpdate() { calls.push("forUpdate"); },
  };
  const trx = ((table: string) => { calls.push(["table", table]); return query; }) as unknown as Knex.Transaction;
  const host = { db: {
    metadata: { get: (uid: string) => { assert.equal(uid, "api::identity-source.identity-source"); return {
      tableName: "runtime_sources", attributes: { id: { columnName: "runtime_id" }, documentId: { columnName: "runtime_document_id" } },
    }; } },
    dialect: { client: "postgres" }, inTransaction: () => false,
    transaction: async (work: (context: unknown) => Promise<unknown>) => work({ trx, onCommit: () => undefined }),
  } } as unknown as Core.Strapi;
  await withSourceLock(host, sourceDocumentId, async () => { calls.push("work"); });
  assert.deepEqual(calls, [["table", "runtime_sources"], ["select", "runtime_id"],
    ["where", "runtime_document_id", sourceDocumentId], "forUpdate", "work"]);
});

test("SQLite retries the complete outer transaction on contention, never a nested transaction", async () => {
  for (const nested of [false, true]) {
    let attempts = 0;
    const query = { whereRaw: () => query, update: async () => undefined };
    const trx = Object.assign(() => query, { ref: (column: string) => column }) as unknown as Knex.Transaction;
    const host = { db: {
      metadata: { get: () => ({ tableName: "sources", attributes: { id: { columnName: "id" }, documentId: { columnName: "document_id" } } }) },
      dialect: { client: "sqlite" }, inTransaction: () => nested,
      transaction: async (work: (context: unknown) => Promise<unknown>) => {
        if (++attempts === 1) throw Object.assign(new Error("contention"), { code: "SQLITE_BUSY" });
        return work({ trx, onCommit: () => undefined });
      },
    } } as unknown as Core.Strapi;
    const result = withSourceLock(host, sourceDocumentId, async () => "done");
    if (nested) { await assert.rejects(result, /contention/); assert.equal(attempts, 1); }
    else { assert.equal(await result, "done"); assert.equal(attempts, 2); }
  }
});
