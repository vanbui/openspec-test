import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { Core } from "@strapi/strapi";
import { seedIamData } from "../src/bootstrap/seed-iam-data";

test("IAM seed stays opt-in with unset or false settings and outside development", async () => {
  const backend = new Proxy({}, { get() { assert.fail("disabled seed must not access the backend"); } }) as Core.Strapi;
  for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "development", IDAMBOX_SEED_IAM: "false" },
    { NODE_ENV: "production", IDAMBOX_SEED_IAM: "true" }]) await seedIamData(backend, env);
});

test("the tracked backend example documents an off IAM seed", () => {
  const example = readFileSync(path.resolve(__dirname, "../../../.env.example"), "utf8");
  const settings = example.split(/\r?\n/).filter(line => /^IDAMBOX_SEED_IAM=/.test(line));
  assert.deepEqual(settings, ["IDAMBOX_SEED_IAM=false"]);
});
