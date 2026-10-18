import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect as netConnect, createServer } from "node:net";
import test from "node:test";

import { createClamavScanner, parseClamdReply } from "../src/csrm/files/clamav-scanner";
import { createDevelopmentScanner, CSRM_TEST_MALWARE_SIGNATURE, EICAR_XOR_5A_HEX, selectMalwareScanner } from "../src/csrm/files/scanner";
import { FAKE_CLAMD_VERSION, startFakeClamd, type FakeClamd, type FakeClamdMode } from "./helpers/fake-clamd-server";

/*
 * The scanner port and its development double (14-03; D-12, D-14). The suites use the CSRM test signature. The one
 * EICAR case decodes the module's stored form in memory, so no file in the repository spells the string.
 */

/** The SHA-256 published with the EICAR specification for its 68-byte test string. */
const EICAR_SHA256 = "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f";

function decodedEicar(): Buffer {
  return Buffer.from(Buffer.from(EICAR_XOR_5A_HEX, "hex").map((byte) => byte ^ 0x5a));
}

test("the development double is named and versioned", () => {
  assert.equal(createDevelopmentScanner().name, "csrm-development-double/1");
});

test("the development double answers clean for ordinary bytes", async () => {
  const verdict = await createDevelopmentScanner().scan(Buffer.from("Vendor security pack, page one.", "utf8"));
  assert.deepEqual(verdict, { kind: "clean", engine: "csrm-development-double/1" });
});

test("the development double flags the CSRM test signature anywhere in the bytes", async () => {
  const bytes = Buffer.concat([Buffer.from([0x00, 0xff, 0x10]), Buffer.from(CSRM_TEST_MALWARE_SIGNATURE, "latin1"), Buffer.from("tail")]);
  const verdict = await createDevelopmentScanner().scan(bytes);
  assert.deepEqual(verdict, { kind: "infected", engine: "csrm-development-double/1", detection: "Csrm.Test.Signature" });
});

test("the stored EICAR form decodes in memory to the published 68-byte test string", () => {
  const eicar = decodedEicar();
  assert.equal(eicar.length, 68);
  assert.equal(createHash("sha256").update(eicar).digest("hex"), EICAR_SHA256);
});

test("the development double flags the EICAR test string decoded in memory", async () => {
  const verdict = await createDevelopmentScanner().scan(decodedEicar());
  assert.deepEqual(verdict, { kind: "infected", engine: "csrm-development-double/1", detection: "Eicar-Test-Signature" });
});

/*
 * The ClamAV adapter (14-03; D-12; 14-RESEARCH Settled 5): INSTREAM over node:net against a fake clamd. Every path
 * that is not a definite answer is "not scanned", never clean.
 */

const PAYLOAD = Buffer.from("Vendor security pack, page one.\n", "utf8");

async function withFakeClamd(mode: FakeClamdMode, action: (fake: FakeClamd) => Promise<void>): Promise<void> {
  const fake = await startFakeClamd({ mode });
  try {
    await action(fake);
  } finally {
    await fake.close();
  }
}

function clamavFor(fake: FakeClamd, timeoutMs = 5_000) {
  return createClamavScanner({ host: fake.host, port: fake.port, timeoutMs });
}

test("clean: stream OK is clean, with the engine from VERSION", async () => {
  await withFakeClamd("clean", async (fake) => {
    const scanner = clamavFor(fake);
    assert.equal(scanner.name, "clamav");
    assert.deepEqual(await scanner.scan(PAYLOAD), { kind: "clean", engine: FAKE_CLAMD_VERSION });
    assert.equal(fake.received.length, 1);
    assert.deepEqual(fake.received[0].bytes, PAYLOAD);
    assert.equal(fake.received[0].terminated, true);
  });
});

test("the engine string is cached between scans", async () => {
  await withFakeClamd("clean", async (fake) => {
    const scanner = clamavFor(fake);
    await scanner.scan(PAYLOAD);
    await scanner.scan(PAYLOAD);
    assert.equal(fake.versionRequests(), 1);
  });
});

test("found: a detection is infected with its name", async () => {
  await withFakeClamd("found:Win.Test.Fake", async (fake) => {
    assert.deepEqual(await clamavFor(fake).scan(PAYLOAD), { kind: "infected", engine: FAKE_CLAMD_VERSION, detection: "Win.Test.Fake" });
  });
});

test("limits: a Heuristics.Limits.Exceeded detection is not scanned for limits, never infected or clean", async () => {
  await withFakeClamd("limits", async (fake) => {
    assert.deepEqual(await clamavFor(fake).scan(PAYLOAD), { kind: "not-scanned", engine: FAKE_CLAMD_VERSION, cause: "limits" });
  });
});

test("size-exceeded: the INSTREAM size limit reply is not scanned for limits", async () => {
  await withFakeClamd("size-exceeded", async (fake) => {
    assert.deepEqual(await clamavFor(fake).scan(PAYLOAD), { kind: "not-scanned", engine: FAKE_CLAMD_VERSION, cause: "limits" });
  });
});

for (const [mode, label] of [
  ["size-exceeded-early:131072", "with its NUL"],
  ["size-exceeded-early-cut:131072", "cut before its NUL, so only the reply that arrived before the connection ended is read"],
] as const) {
  test(`size-exceeded mid-stream: clamd's reply, written before it closes on a client still sending chunks, is not scanned for limits, ${label} (WR-307)`, async () => {
    await withFakeClamd(mode, async (fake) => {
      const payload = Buffer.alloc(4 * 1024 * 1024, 0x61);
      assert.deepEqual(await clamavFor(fake).scan(payload), { kind: "not-scanned", engine: FAKE_CLAMD_VERSION, cause: "limits" });
      const stream = fake.received[0];
      assert.equal(stream.terminated, false, "THE_FAKE_ANSWERED_AFTER_THE_TERMINATOR");
      assert.ok(stream.chunkLengths.length >= 2 && stream.bytes.length < payload.length, `THE_REPLY_WAS_NOT_MID_STREAM: ${stream.chunkLengths.length} chunks, ${stream.bytes.length} bytes`);
    });
  });
}

test("close: a connection dropped without a reply is not scanned, unavailable", async () => {
  await withFakeClamd("close", async (fake) => {
    assert.deepEqual(await clamavFor(fake).scan(PAYLOAD), { kind: "not-scanned", engine: FAKE_CLAMD_VERSION, cause: "unavailable" });
  });
});

test("silent: a server that never answers is not scanned, timed out", async () => {
  await withFakeClamd("silent", async (fake) => {
    const started = Date.now();
    const verdict = await clamavFor(fake, 200).scan(PAYLOAD);
    assert.equal(verdict.kind, "not-scanned");
    assert.equal(verdict.kind === "not-scanned" ? verdict.cause : null, "timeout");
    assert.ok(Date.now() - started < 3_000, "the scan timeout bounds the wait");
  });
});

test("down: a connection clamd drops as it arrives is not scanned, unavailable (IN-304)", async () => {
  await withFakeClamd("down", async (fake) => {
    const verdict = await clamavFor(fake).scan(PAYLOAD);
    assert.equal(verdict.kind, "not-scanned");
    assert.equal(verdict.kind === "not-scanned" ? verdict.cause : null, "unavailable");
  });
});

test("a scanner recovers when clamd comes back", async () => {
  await withFakeClamd("down", async (fake) => {
    const scanner = clamavFor(fake);
    assert.equal((await scanner.scan(PAYLOAD)).kind, "not-scanned");
    await fake.setMode("clean");
    assert.deepEqual(await scanner.scan(PAYLOAD), { kind: "clean", engine: FAKE_CLAMD_VERSION });
  });
});

test("down keeps the fake's port bound, so no other listener can take it before clamd comes back (IN-304)", async () => {
  await withFakeClamd("clean", async (fake) => {
    await fake.setMode("down");
    const intruder = createServer();
    const bound = await new Promise<string>((resolve) => {
      intruder.once("error", (error: NodeJS.ErrnoException) => resolve(error.code ?? "error"));
      intruder.listen(fake.port, "127.0.0.1", () => resolve("listening"));
    });
    if (bound === "listening") await new Promise<void>((resolve) => intruder.close(() => resolve()));
    assert.equal(bound, "EADDRINUSE", "ANOTHER_LISTENER_TOOK_THE_PORT_WHILE_THE_FAKE_WAS_DOWN");
    await fake.setMode("clean");
    assert.deepEqual(await clamavFor(fake).scan(PAYLOAD), { kind: "clean", engine: FAKE_CLAMD_VERSION });
  });
});

test("an aborted scan is not scanned, never clean", async () => {
  await withFakeClamd("silent", async (fake) => {
    const controller = new AbortController();
    const pending = clamavFor(fake).scan(PAYLOAD, controller.signal);
    setTimeout(() => controller.abort(), 50);
    const verdict = await pending;
    assert.equal(verdict.kind, "not-scanned");
  });
});

test("a 3 MiB payload arrives as 48 chunks of 65,536 bytes and the terminator, byte for byte", async () => {
  await withFakeClamd("clean", async (fake) => {
    const payload = Buffer.alloc(3 * 1024 * 1024);
    for (let index = 0; index < payload.length; index += 1) payload[index] = (index * 31 + 7) & 0xff;
    assert.equal((await clamavFor(fake).scan(payload)).kind, "clean");
    const stream = fake.received[0];
    assert.equal(stream.chunkLengths.length, 48);
    assert.ok(stream.chunkLengths.every((length) => length === 65_536));
    assert.equal(stream.terminated, true);
    assert.equal(stream.bytes.equals(payload), true);
  });
});

test("parseClamdReply maps each clamd reply to a verdict", () => {
  const engine = "ClamAV test";
  assert.deepEqual(parseClamdReply("stream: OK\0", engine), { kind: "clean", engine });
  assert.deepEqual(parseClamdReply("stream: Win.Test.Fake FOUND", engine), { kind: "infected", engine, detection: "Win.Test.Fake" });
  assert.deepEqual(parseClamdReply("stream: Heuristics.Limits.Exceeded.MaxScanSize FOUND", engine), { kind: "not-scanned", engine, cause: "limits" });
  assert.deepEqual(parseClamdReply("INSTREAM size limit exceeded. ERROR", engine), { kind: "not-scanned", engine, cause: "limits" });
  assert.deepEqual(parseClamdReply("stream: Can't allocate memory ERROR", engine), { kind: "not-scanned", engine, cause: "error" });
  assert.deepEqual(parseClamdReply("UNKNOWN COMMAND", engine), { kind: "not-scanned", engine, cause: "error" });
  assert.deepEqual(parseClamdReply("", engine), { kind: "not-scanned", engine, cause: "error" });
});

test("selectMalwareScanner gives the double, the ClamAV adapter, or nothing", () => {
  assert.equal(selectMalwareScanner({ kind: "development" })?.name, "csrm-development-double/1");
  assert.equal(selectMalwareScanner({ kind: "clamav", host: "127.0.0.1", port: 3310, timeoutMs: 60_000 })?.name, "clamav");
  assert.equal(selectMalwareScanner(null), null);
});

/*
 * IN-210: `timeoutMs` is the whole exchange's bound. The adapter streams the file first and asks for the engine's name
 * after it, within what is left of the same deadline, so a slow VERSION can neither lengthen a scan nor eat the stream's
 * time. A VERSION that fails leaves the fallback name, cached for a short window: during an outage a scan costs one
 * connection, not two, and when clamd answers the stream but not VERSION, later scans do not wait for VERSION again.
 * A clamd that answers the stream again is asked for its real name at once, so a recovery is not recorded under the
 * fallback name; after the window the name is asked for again in any case.
 */
test("one deadline bounds the whole exchange: with VERSION and INSTREAM both slow, a scan ends within timeoutMs (IN-210)", async () => {
  const timeoutMs = 1_000;
  const tolerance = 250;
  await withFakeClamd("clean", async (fake) => {
    fake.setDelays({ versionMs: 700, instreamMs: 700 });
    const scanner = clamavFor(fake, timeoutMs);
    let started = Date.now();
    const answered = await scanner.scan(PAYLOAD);
    const answeredMs = Date.now() - started;
    assert.ok(answeredMs <= timeoutMs + tolerance, `A_SCAN_OUTLASTED_ITS_DEADLINE_SLOW_REPLIES: ${answeredMs} ms`);
    assert.equal(answered.kind, "clean", "THE_STREAM'S_VERDICT_WAS_LOST");

    // VERSION failed while clamd answered the stream: the next scan does not wait for it again within the window.
    fake.setDelays({ versionMs: 700, instreamMs: 0 });
    const versionsBefore = fake.versionRequests();
    started = Date.now();
    assert.deepEqual(await scanner.scan(PAYLOAD), { kind: "clean", engine: "clamav" }, "UNEXPECTED_VERDICT_AFTER_A_SLOW_VERSION");
    const quickMs = Date.now() - started;
    assert.ok(quickMs < 500, `A_SCAN_WAITED_FOR_VERSION_AGAIN: ${quickMs} ms`);
    assert.equal(fake.versionRequests(), versionsBefore, "VERSION_WAS_ASKED_AGAIN_WITHIN_THE_WINDOW");

    fake.setDelays({ versionMs: 700, instreamMs: 5_000 });
    started = Date.now();
    const silent = await clamavFor(fake, timeoutMs).scan(PAYLOAD);
    const silentMs = Date.now() - started;
    assert.ok(silentMs <= timeoutMs + tolerance, `A_SCAN_OUTLASTED_ITS_DEADLINE_SLOW_STREAM: ${silentMs} ms`);
    assert.deepEqual([silent.kind, silent.kind === "not-scanned" ? silent.cause : null], ["not-scanned", "timeout"], "UNEXPECTED_SLOW_STREAM_VERDICT");
  });
});

test("an outage costs one connection per scan once the fallback name is cached, and the real name is asked for after the window or once clamd answers again (IN-210)", async () => {
  await withFakeClamd("down", async (fake) => {
    let connections = 0;
    let now = 1_000_000;
    const scanner = createClamavScanner({
      host: fake.host,
      port: fake.port,
      timeoutMs: 5_000,
      connect: (target) => {
        connections += 1;
        return netConnect(target);
      },
      now: () => now,
    } as Parameters<typeof createClamavScanner>[0]);
    const outage = { kind: "not-scanned", engine: "clamav", cause: "unavailable" };
    const connectionsFor = async (): Promise<number> => {
      const before = connections;
      assert.deepEqual(await scanner.scan(PAYLOAD), outage, "UNEXPECTED_OUTAGE_VERDICT");
      return connections - before;
    };
    assert.equal(await connectionsFor(), 2, "UNEXPECTED_FIRST_OUTAGE_CONNECTIONS");
    assert.equal(await connectionsFor(), 1, "AN_OUTAGE_COSTS_TWO_CONNECTIONS_PER_SCAN");
    now += 59_000;
    assert.equal(await connectionsFor(), 1, "THE_FALLBACK_NAME_WAS_NOT_REUSED_WITHIN_ITS_WINDOW");
    now += 1_001;
    assert.equal(await connectionsFor(), 2, "THE_NAME_WAS_NOT_ASKED_FOR_AFTER_THE_WINDOW");

    await fake.setMode("clean");
    assert.deepEqual(await scanner.scan(PAYLOAD), { kind: "clean", engine: FAKE_CLAMD_VERSION }, "A_RECOVERY_WAS_RECORDED_UNDER_THE_FALLBACK_NAME");
    assert.deepEqual(await scanner.scan(PAYLOAD), { kind: "clean", engine: FAKE_CLAMD_VERSION }, "UNEXPECTED_SECOND_CLEAN_VERDICT");
    assert.equal(fake.versionRequests(), 1, "THE_REAL_NAME_WAS_NOT_CACHED");
  });
});
