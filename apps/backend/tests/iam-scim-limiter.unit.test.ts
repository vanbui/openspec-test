import assert from "node:assert/strict";
import { test } from "node:test";
import { readScimConfig } from "../src/iam/scim/config";
import { createScimLimiter } from "../src/iam/scim/limiter";

test("startup defaults and positive integer overrides are strict and bounded", () => {
  assert.deepEqual(readScimConfig({}), { ipLimit: 1200, sourceLimit: 600 });
  assert.deepEqual(readScimConfig({ IDAMBOX_SCIM_IP_LIMIT: "2", IDAMBOX_SCIM_SOURCE_LIMIT: "1" }), { ipLimit: 2, sourceLimit: 1 });
  for (const key of ["IDAMBOX_SCIM_IP_LIMIT", "IDAMBOX_SCIM_SOURCE_LIMIT"]) {
    for (const value of ["", " ", "0", "-1", "1.5", "NaN", "Infinity", "9007199254740992", "1e3", "0x10"]) {
      assert.throws(() => readScimConfig({ [key]: value }), /positive integer/);
    }
  }
});
test("independent IP and verified-source budgets span operations and reset at the boundary", () => {
  let now = 0;
  const limiter = createScimLimiter({ ipLimit: 2, sourceLimit: 1 }, () => now);
  assert.equal(limiter.ip("ip").allowed, true);
  assert.equal(limiter.ip("ip").allowed, true);
  assert.deepEqual(limiter.ip("ip"), { allowed: false, retryAfter: 60 });
  assert.equal(limiter.source("source-a").allowed, true);
  assert.deepEqual(limiter.source("source-a"), { allowed: false, retryAfter: 60 });
  assert.equal(limiter.source("source-b").allowed, true);
  now = 59_001;
  assert.deepEqual(limiter.ip("ip"), { allowed: false, retryAfter: 1 });
  now = 60_000;
  assert.equal(limiter.ip("ip").allowed, true);
  assert.equal(limiter.source("source-a").allowed, true);
  assert.deepEqual(limiter.size(), { ip: 1, source: 1 });
});
test("attacker keys cannot exceed caps or evict an active budget; expiry frees capacity", () => {
  let now = 0;
  const limiter = createScimLimiter({ ipLimit: 1, sourceLimit: 1 }, () => now);
  for (let i = 0; i < 10_000; i++) assert.equal(limiter.ip(String(i)).allowed, true);
  for (let i = 0; i < 1000; i++) assert.equal(limiter.source(String(i)).allowed, true);
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(limiter.ip(`attacker-${i}`), { allowed: false, retryAfter: 60 });
    assert.deepEqual(limiter.source(`attacker-${i}`), { allowed: false, retryAfter: 60 });
  }
  assert.deepEqual(limiter.size(), { ip: 10_000, source: 1000 });
  assert.equal(limiter.ip("0").allowed, false);
  assert.equal(limiter.source("0").allowed, false);
  now = 60_000;
  assert.equal(limiter.ip("new").allowed, true);
  assert.equal(limiter.source("new").allowed, true);
  assert.deepEqual(limiter.size(), { ip: 1, source: 1 });
});
test("capacity retry waits for the earliest live bucket without eviction", () => {
  let now = 0;
  const limiter = createScimLimiter({ ipLimit: 1, sourceLimit: 1 }, () => now);
  limiter.source("first");
  now = 10_000;
  for (let i = 1; i < 1000; i++) limiter.source(String(i));
  now = 59_500;
  assert.deepEqual(limiter.source("overflow"), { allowed: false, retryAfter: 1 });
  now = 60_000;
  assert.equal(limiter.source("overflow").allowed, true);
  assert.equal(limiter.source("1").allowed, false);
  assert.equal(limiter.size().source, 1000);
});

test("effective default budgets allow exactly 1200 IP and 600 source requests", () => {
  const limiter = createScimLimiter(readScimConfig({}), () => 0);
  for (let i = 0; i < 1200; i++) assert.equal(limiter.ip("client").allowed, true);
  assert.equal(limiter.ip("client").allowed, false);
  for (let i = 0; i < 600; i++) assert.equal(limiter.source("source").allowed, true);
  assert.equal(limiter.source("source").allowed, false);
});
