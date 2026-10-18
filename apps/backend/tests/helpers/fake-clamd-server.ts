import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

/*
 * A fake clamd (14-03; D-12, D-14), modelled on fake-openai-compatible-server.ts. It speaks the two commands the
 * ClamAV adapter sends: `zVERSION\0`, answered with a fixed engine string, and `zINSTREAM\0`, whose length-prefixed
 * chunks it records byte for byte before answering per its mode. No real engine, signature database or malware test
 * string is involved.
 *
 * Modes:
 * - `clean`: `stream: OK`
 * - `found:{name}`: `stream: {name} FOUND`
 * - `limits`: `stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND` (AlertExceedsMax on)
 * - `size-exceeded`: `INSTREAM size limit exceeded. ERROR` (StreamMaxLength reached), after the terminator
 * - `size-exceeded-early:{bytes}`: as a real clamd does (WR-307): once that many payload bytes have arrived, the same
 *   reply is written mid-stream and the fake closes its side before the terminator, while the client is still writing.
 *   It closes with a FIN and drains whatever the client still sends, rather than destroying the socket: a real clamd
 *   closes with unread data, which resets the connection, and on Windows a reset discards a reply the client has not
 *   yet read, so a destroy would test the host's TCP stack instead of the adapter.
 * - `size-exceeded-early-cut:{bytes}`: the same, with the reply's NUL terminator lost to the close, so the client holds
 *   only the reply's text when the connection ends (the adapter's "reply that arrived before the connection failed")
 * - `close`: the connection is dropped as soon as INSTREAM arrives, with no reply
 * - `silent`: the stream is read and never answered
 * - `down`: every connection is dropped as it arrives, with no reply. IN-304: the port stays bound while the fake is
 *   down, so no other process can take it before a test brings clamd back (a re-listen could meet EADDRINUSE)
 *
 * IN-210: `setDelays` holds each VERSION reply, or each INSTREAM reply once the stream has arrived, for the given time,
 * so a test can show that one deadline bounds the adapter's whole exchange. `streamArrived` resolves when the next
 * INSTREAM command arrives, so a test can act while a scan is in flight.
 */

export type FakeClamdMode = "clean" | `found:${string}` | "limits" | "size-exceeded" | `size-exceeded-early:${number}` | `size-exceeded-early-cut:${number}` | "close" | "silent" | "down";

export const FAKE_CLAMD_VERSION = "ClamAV 1.4.1/27500/Wed Sep 30 2026";

export interface ReceivedStream {
  /** Each chunk's declared length, in order, without the zero-length terminator. */
  readonly chunkLengths: number[];
  /** The chunks' bytes, concatenated. */
  readonly bytes: Buffer;
  /** Whether the zero-length terminator arrived. */
  terminated: boolean;
}

function receivedStream(): ReceivedStream & { readonly parts: Buffer[] } {
  const parts: Buffer[] = [];
  return {
    chunkLengths: [],
    parts,
    terminated: false,
    get bytes() {
      return Buffer.concat(parts);
    },
  };
}

export interface FakeClamd {
  readonly host: string;
  readonly port: number;
  /** Every INSTREAM the fake has read, in arrival order. */
  readonly received: ReceivedStream[];
  /** How many VERSION commands it answered. */
  versionRequests(): number;
  setMode(mode: FakeClamdMode): Promise<void>;
  /** IN-210: how long each VERSION and each INSTREAM reply waits before it is sent (0 by default). */
  setDelays(delays: { readonly versionMs?: number; readonly instreamMs?: number }): void;
  /** IN-210: resolves when the next INSTREAM command arrives. */
  streamArrived(): Promise<void>;
  close(): Promise<void>;
}

const VERSION_COMMAND = Buffer.from("zVERSION\0", "latin1");
const INSTREAM_COMMAND = Buffer.from("zINSTREAM\0", "latin1");

/**
 * WR-307: for the two mid-stream modes, the payload byte count after which the fake answers, and whether the reply
 * keeps its NUL terminator; null for every other mode.
 */
function earlyReplyOf(mode: FakeClamdMode): { readonly limit: number; readonly terminated: boolean } | null {
  const prefix = mode.startsWith("size-exceeded-early:") ? "size-exceeded-early:" : mode.startsWith("size-exceeded-early-cut:") ? "size-exceeded-early-cut:" : null;
  if (prefix === null) return null;
  const limit = Number(mode.slice(prefix.length));
  return Number.isSafeInteger(limit) && limit > 0 ? { limit, terminated: prefix === "size-exceeded-early:" } : null;
}

function replyFor(mode: FakeClamdMode): string | null {
  if (mode === "clean") return "stream: OK";
  if (mode === "limits") return "stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND";
  if (mode === "size-exceeded" || earlyReplyOf(mode) !== null) return "INSTREAM size limit exceeded. ERROR";
  if (mode.startsWith("found:")) return `stream: ${mode.slice("found:".length)} FOUND`;
  return null;
}

export async function startFakeClamd(options: { mode: FakeClamdMode }): Promise<FakeClamd> {
  let mode = options.mode;
  let versions = 0;
  let delays = { versionMs: 0, instreamMs: 0 };
  let streamWaiters: Array<() => void> = [];
  const received: ReceivedStream[] = [];
  const sockets = new Set<Socket>();

  /** Ends the socket with `reply` after `delayMs`, unless the client has gone by then. */
  const answer = (socket: Socket, reply: string, delayMs: number): void => {
    if (delayMs <= 0) {
      socket.end(reply);
      return;
    }
    const timer = setTimeout(() => {
      if (!socket.destroyed) socket.end(reply);
    }, delayMs);
    socket.once("close", () => clearTimeout(timer));
  };

  const handle = (socket: Socket): void => {
    if (mode === "down") {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let pending = Buffer.alloc(0);
    let stream: ReturnType<typeof receivedStream> | null = null;
    let commandSeen = false;
    let draining = false;

    socket.on("data", (data: Buffer) => {
      if (draining) return;
      pending = Buffer.concat([pending, data]);
      if (!commandSeen) {
        if (pending.length >= VERSION_COMMAND.length && pending.subarray(0, VERSION_COMMAND.length).equals(VERSION_COMMAND)) {
          commandSeen = true;
          versions += 1;
          answer(socket, `${FAKE_CLAMD_VERSION}\0`, delays.versionMs);
          return;
        }
        if (pending.length < INSTREAM_COMMAND.length) return;
        if (!pending.subarray(0, INSTREAM_COMMAND.length).equals(INSTREAM_COMMAND)) {
          commandSeen = true;
          socket.end("UNKNOWN COMMAND\0");
          return;
        }
        commandSeen = true;
        pending = pending.subarray(INSTREAM_COMMAND.length);
        stream = receivedStream();
        received.push(stream);
        const waiters = streamWaiters;
        streamWaiters = [];
        for (const resolve of waiters) resolve();
        if (mode === "close") {
          socket.destroy();
          return;
        }
      }
      if (stream === null || stream.terminated) return;
      while (pending.length >= 4) {
        const length = pending.readUInt32BE(0);
        if (length === 0) {
          stream.terminated = true;
          pending = pending.subarray(4);
          break;
        }
        if (pending.length < 4 + length) break;
        stream.chunkLengths.push(length);
        stream.parts.push(Buffer.from(pending.subarray(4, 4 + length)));
        pending = pending.subarray(4 + length);
        const early = earlyReplyOf(mode);
        if (early !== null && stream.bytes.length >= early.limit) {
          // WR-307: clamd checks StreamMaxLength per chunk, answers, and closes while the client is still writing.
          // Nothing more is recorded: the rest of the stream is drained, so the close never becomes a reset.
          socket.end(early.terminated ? `${replyFor(mode)}\0` : `${replyFor(mode)}`);
          draining = true;
          pending = Buffer.alloc(0);
          return;
        }
      }
      if (stream.terminated) {
        const reply = replyFor(mode);
        if (reply !== null) answer(socket, `${reply}\0`, delays.instreamMs);
      }
    });
  };

  const server: Server = createServer(handle);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return {
    host: "127.0.0.1",
    port,
    received,
    versionRequests: () => versions,
    async setMode(next: FakeClamdMode) {
      mode = next;
      // A clamd that goes down drops the connections it holds; the port stays bound (IN-304).
      if (next === "down") for (const socket of sockets) socket.destroy();
    },
    setDelays(next) {
      delays = { versionMs: next.versionMs ?? 0, instreamMs: next.instreamMs ?? 0 };
    },
    streamArrived() {
      return new Promise<void>((resolve) => streamWaiters.push(resolve));
    },
    close,
  };
}
