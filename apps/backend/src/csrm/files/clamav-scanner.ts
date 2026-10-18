import { Buffer } from "node:buffer";
import { connect as netConnect, type Socket } from "node:net";

/*
 * The ClamAV adapter (14-03; D-12; 14-RESEARCH Settled 5). It speaks clamd's INSTREAM protocol over TCP with Node's
 * own `net`, so no package is added: `zINSTREAM\0`, then chunks of at most 65,536 bytes, each after its 4-byte
 * big-endian length, then four zero bytes. `zVERSION\0` names the engine and signature database, cached for ten
 * minutes.
 *
 * IN-210: `timeoutMs` bounds the whole scan. The file is streamed first, and the engine's name is asked for afterwards,
 * within what is left of the same deadline, so a slow VERSION can neither lengthen a scan nor take the stream's time.
 * A VERSION that fails leaves the adapter's own name (`clamav`) on the verdict, and that fallback is cached for a
 * minute: during an outage a scan then costs one connection, not two. A fallback cached while clamd could not be
 * reached at all does not stop the name being asked for once clamd answers a stream again, so a recovery is recorded
 * under the real name; one cached while clamd answered the stream but not VERSION does, so no scan waits for VERSION
 * again within the minute. The protocol is plain, unauthenticated TCP, so clamd must be reachable only on loopback or a
 * private network (apps/backend/README.md).
 *
 * It fails closed. Only `stream: OK` is clean and only a named detection is infected. A limits detection
 * (`Heuristics.Limits.Exceeded`, with clamd's AlertExceedsMax on) and the INSTREAM size-limit reply are "not scanned"
 * for limits; a refused, dropped or reset connection is "not scanned", unavailable; a connect beyond two seconds is
 * unavailable; a scan beyond the configured timeout is timed out; anything else is an error. Running clamd with
 * freshclam, and its limits above 25 MiB, are deployment work (apps/backend/README.md).
 *
 * The verdict type is structurally the scanner port's `ScanVerdict` (scanner.ts), declared here so this module imports
 * nothing but `node:net` and `node:buffer`.
 */

export type ClamavVerdict =
  | { readonly kind: "clean"; readonly engine: string }
  | { readonly kind: "infected"; readonly engine: string; readonly detection: string }
  | { readonly kind: "not-scanned"; readonly engine: string; readonly cause: "unavailable" | "timeout" | "limits" | "error" };

type NotScannedCause = Extract<ClamavVerdict, { kind: "not-scanned" }>["cause"];

export type ClamdConnect = (options: { host: string; port: number }) => Socket;

export interface ClamavScannerOptions {
  readonly host: string;
  readonly port: number;
  /** The whole scan's bound: the stream's connect, send and reply, then the engine's name within what is left. */
  readonly timeoutMs: number;
  readonly connectTimeoutMs?: number;
  /** For tests only; defaults to `net.connect`. */
  readonly connect?: ClamdConnect;
  /** For tests only: the clock the deadline and the name caches read; defaults to `Date.now`. */
  readonly now?: () => number;
}

export interface ClamavScanner {
  readonly name: "clamav";
  scan(bytes: Uint8Array, signal?: AbortSignal): Promise<ClamavVerdict>;
}

export const CLAMAV_SCANNER_NAME = "clamav";
export const CLAMD_CHUNK_BYTES = 65_536;
export const CLAMD_CONNECT_TIMEOUT_MS = 2_000;
export const CLAMD_ENGINE_CACHE_MS = 600_000;
/** IN-210: how long the fallback name is used after a VERSION that failed, before the name is asked for again. */
export const CLAMD_ENGINE_FALLBACK_CACHE_MS = 60_000;

/** A clamd reply is one short line; anything longer is refused as an error. */
const MAX_REPLY_BYTES = 4_096;
const MAX_DETECTION_LENGTH = 200;
const UNAVAILABLE_CODES = new Set(["ECONNREFUSED", "EPIPE", "ECONNRESET", "ECONNABORTED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"]);

/** Maps one clamd reply (NUL terminator and whitespace allowed) to a verdict. */
export function parseClamdReply(reply: string, engine: string): ClamavVerdict {
  const line = reply.replace(/\0+$/, "").trim();
  if (/size limit exceeded/i.test(line)) return { kind: "not-scanned", engine, cause: "limits" };
  if (/^(?:\d+: )?stream: OK$/.test(line)) return { kind: "clean", engine };
  const found = /^(?:\d+: )?stream: (.+) FOUND$/.exec(line);
  if (found) {
    const detection = found[1].trim().slice(0, MAX_DETECTION_LENGTH);
    if (detection.startsWith("Heuristics.Limits.Exceeded")) return { kind: "not-scanned", engine, cause: "limits" };
    if (detection !== "") return { kind: "infected", engine, detection };
  }
  return { kind: "not-scanned", engine, cause: "error" };
}

type Exchange = { readonly reply: string } | { readonly cause: NotScannedCause };

function causeOf(error: unknown): NotScannedCause {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && UNAVAILABLE_CODES.has(code) ? "unavailable" : "error";
}

/**
 * One clamd exchange: connect (bounded by `connectTimeoutMs`), send, and read the NUL-terminated reply, the whole
 * bounded by `timeoutMs`. A reply that arrived before the connection failed is still read, because clamd answers a
 * stream over its limit and then closes while the client is writing.
 */
function exchange(options: Required<Omit<ClamavScannerOptions, "connect" | "now">> & { connect: ClamdConnect }, send: (socket: Socket) => void, signal?: AbortSignal): Promise<Exchange> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ cause: "error" });
      return;
    }
    const received: Buffer[] = [];
    let size = 0;
    let settled = false;
    let socket: Socket | null = null;
    const replyText = (): string => Buffer.concat(received).toString("utf8");
    const finish = (result: Exchange): void => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(overallTimer);
      signal?.removeEventListener("abort", onAbort);
      socket?.destroy();
      resolve(result);
    };
    const onAbort = (): void => finish({ cause: "error" });
    const connectTimer = setTimeout(() => finish({ cause: "unavailable" }), options.connectTimeoutMs);
    const overallTimer = setTimeout(() => finish({ cause: "timeout" }), options.timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      socket = options.connect({ host: options.host, port: options.port });
    } catch (error) {
      finish({ cause: causeOf(error) });
      return;
    }
    socket.once("connect", () => {
      clearTimeout(connectTimer);
      try {
        if (socket) send(socket);
      } catch {
        finish({ cause: "error" });
      }
    });
    socket.on("data", (data: Buffer) => {
      size += data.length;
      if (size > MAX_REPLY_BYTES) {
        finish({ cause: "error" });
        return;
      }
      received.push(data);
      if (data.includes(0)) finish({ reply: replyText() });
    });
    socket.once("end", () => finish(size > 0 ? { reply: replyText() } : { cause: "unavailable" }));
    socket.once("close", () => finish(size > 0 ? { reply: replyText() } : { cause: "unavailable" }));
    socket.on("error", (error: Error) => finish(size > 0 ? { reply: replyText() } : { cause: causeOf(error) }));
  });
}

function writeInstream(socket: Socket, bytes: Uint8Array): void {
  socket.write(Buffer.from("zINSTREAM\0", "latin1"));
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset < view.length; offset += CLAMD_CHUNK_BYTES) {
    const chunk = view.subarray(offset, Math.min(offset + CLAMD_CHUNK_BYTES, view.length));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(chunk.length, 0);
    socket.write(length);
    socket.write(chunk);
  }
  socket.write(Buffer.alloc(4));
}

/** A ClamAV scanner for one clamd endpoint. */
export function createClamavScanner(options: ClamavScannerOptions): ClamavScanner {
  const settings = {
    host: options.host,
    port: options.port,
    timeoutMs: options.timeoutMs,
    connectTimeoutMs: options.connectTimeoutMs ?? CLAMD_CONNECT_TIMEOUT_MS,
    connect: options.connect ?? ((target: { host: string; port: number }) => netConnect(target)),
  };
  const now = options.now ?? Date.now;
  let engine: { readonly value: string; readonly at: number } | null = null;
  /** The last VERSION that failed (IN-210): when, and whether clamd had just answered the stream. */
  let fallback: { readonly at: number; readonly streamAnswered: boolean } | null = null;

  /** The engine's name for a verdict, asked for within what is left of the scan's deadline. */
  const engineName = async (deadline: number, streamAnswered: boolean, signal?: AbortSignal): Promise<string> => {
    if (engine !== null && now() - engine.at < CLAMD_ENGINE_CACHE_MS) return engine.value;
    if (fallback !== null && now() - fallback.at < CLAMD_ENGINE_FALLBACK_CACHE_MS && (fallback.streamAnswered || !streamAnswered)) return CLAMAV_SCANNER_NAME;
    const remaining = deadline - now();
    if (remaining <= 0 || signal?.aborted) return CLAMAV_SCANNER_NAME;
    const result = await exchange({ ...settings, timeoutMs: remaining }, (socket) => socket.write(Buffer.from("zVERSION\0", "latin1")), signal);
    const value = "reply" in result ? result.reply.replace(/\0+$/, "").trim().slice(0, MAX_DETECTION_LENGTH) : "";
    if (!/^ClamAV /.test(value)) {
      fallback = { at: now(), streamAnswered };
      return CLAMAV_SCANNER_NAME;
    }
    engine = { value, at: now() };
    fallback = null;
    return value;
  };

  return {
    name: CLAMAV_SCANNER_NAME,
    async scan(bytes: Uint8Array, signal?: AbortSignal): Promise<ClamavVerdict> {
      const deadline = now() + settings.timeoutMs;
      const result = await exchange(settings, (socket) => writeInstream(socket, bytes), signal);
      const name = await engineName(deadline, "reply" in result, signal);
      return "reply" in result ? parseClamdReply(result.reply, name) : { kind: "not-scanned", engine: name, cause: result.cause };
    },
  };
}
