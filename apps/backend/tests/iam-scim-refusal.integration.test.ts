import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startRefusalFixture } from "./helpers/iam-live-scim-gate";

let fixture: Awaited<ReturnType<typeof startRefusalFixture>>;
before(async () => { fixture = await startRefusalFixture(); });
after(async () => { await fixture?.close(); });

for (const method of ["PUT", "PATCH", "DELETE"] as const) {
  test(`${method} refuses the same signed human and API credentials before outage recovery, retaining references`, async () => {
    const scenario = await fixture.scenario(method);
    try {
      await scenario.baseline();
      fixture.outage(true);
      await scenario.deactivate();
      await scenario.refusal();
      await scenario.pending();
      await scenario.references();
      await scenario.retryUnavailable();
      // Refusal must already have passed before the remote can recover.
      fixture.outage(false);
      await scenario.recover();
      await scenario.refusal();
    } finally { fixture.outage(false); }
  });
}
