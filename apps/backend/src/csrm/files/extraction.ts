import path from "node:path";
import { Worker } from "node:worker_threads";

import { XLSX_READER_ENGINE } from "../spreadsheets/xlsx-reader";
import { ATTACHMENT_LIMITS } from "./attachment-policy";

/*
 * Text extraction (14-02; D-31 to D-33). An attached file is hostile until proven otherwise, so its text is read in a
 * worker thread with a heap limit and a wall clock, and the worker is terminated on overrun. The heap limit is held twice
 * (IN-306): V8's `resourceLimits`, which not every runtime enforces, and a watchdog in this thread that reads the worker's
 * heap and terminates it once the heap in use passes the limit. Workers run one at a
 * time through a single-slot queue (T-14-06), the PDF open check included, so at most one file's parse is in memory.
 * The queue is bounded (WR-204): at most EXTRACTION_QUEUE_MAX_WAITING tasks wait behind the running one, and the next is
 * refused at once with ExtractionBusyError, which the attachment service answers 503 ATTACHMENT_BUSY.
 *
 * A worker is a resource boundary, not a privilege boundary (WR-202; R-08-43): it runs in Strapi's process with the full
 * Node API, so it starts with an empty environment and no Node flags, and none of Strapi's secrets is in its reach.
 * Nothing in the worker reads `process.env`; anything it needs travels in `workerData`.
 *
 * Every failure is the same answer, ATTACHMENT_TEXT_UNAVAILABLE: a timeout, a heap overrun, a crash, an unreadable
 * file, a refused archive or a file with no text. The worker's output streams are drained and discarded, so nothing a
 * file contains reaches the logs (G-3).
 *
 * The text is normalised (normaliseExtractedText) and capped in the worker: `available` is how many characters the
 * file has after normalisation, `kept` how many were kept (at most `cap`, never splitting a surrogate pair).
 */

export type TextBearingType = "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "txt";

const TEXT_BEARING_TYPES: readonly TextBearingType[] = ["pdf", "docx", "xlsx", "pptx", "csv", "txt"];

export interface ExtractionLimits {
  /** The worker's V8 old-generation heap, in MB. */
  readonly heapMb: number;
  /** How long an extraction may run, from the worker's start. */
  readonly wallClockMs: number;
  /** How long the PDF open check may run. */
  readonly pdfProbeMs: number;
}

/** D-32's limits. The measured worst case (a 25.7 MB, 4,200-page PDF) used about half the heap and a quarter of the time. */
export const EXTRACTION_LIMITS: Readonly<ExtractionLimits> = Object.freeze({ heapMb: 768, wallClockMs: 30_000, pdfProbeMs: 10_000 });

/** D-33: the characters kept per file unless the caller asks for fewer: the attachment policy's one figure (IN-201). */
export const EXTRACTION_TEXT_CAP = ATTACHMENT_LIMITS.textCapCharacters;

/** Recorded with every extracted text, so a change of extractor is visible in the facts it produced. */
export const EXTRACTOR_VERSION = `csrm-extract/1 unpdf/1.8.1 ${XLSX_READER_ENGINE}`;

/** Lifecycle callbacks for one worker; tests use them to observe termination and the queue. */
export interface ExtractionObserver {
  onWorkerStart?(): void;
  onWorkerExit?(): void;
}

export interface ExtractedText {
  readonly ok: true;
  readonly text: string;
  readonly available: number;
  readonly kept: number;
  readonly truncated: boolean;
  readonly extractor: string;
}

export interface TextUnavailable {
  readonly ok: false;
  readonly reason: "ATTACHMENT_TEXT_UNAVAILABLE";
}

export type PdfProbe = "ok" | "password" | "invalid";

/** What the worker receives as `workerData`. `bytes` is transferred, never cloned. */
export type ExtractionRequest =
  | { readonly op: "probe-pdf"; readonly bytes: ArrayBuffer }
  | { readonly op: "extract"; readonly type: TextBearingType; readonly bytes: ArrayBuffer; readonly cap: number };

/** What the worker posts back. A failure carries a closed code only, never file content or an error message. */
export type ExtractionReply =
  | { readonly ok: true; readonly kind: PdfProbe }
  | { readonly ok: true; readonly text: string; readonly available: number }
  | { readonly ok: false; readonly code: string };

const UNAVAILABLE: TextUnavailable = Object.freeze({ ok: false, reason: "ATTACHMENT_TEXT_UNAVAILABLE" });

// C0 and C1 controls and DEL, except tab (U+0009) and line feed (U+000A). Carriage returns are converted first.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** Converts CRLF and CR to LF, removes control characters other than tab and line feed, and applies NFC. */
export function normaliseExtractedText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(CONTROL_CHARACTERS, "").normalize("NFC");
}

/** The first `cap` UTF-16 code units of `text`, one fewer when the cut would split a surrogate pair. */
export function capExtractedText(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const last = text.charCodeAt(cap - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? cap - 1 : cap);
}

const WORKER_PATH = path.join(__dirname, "extraction-worker.js");

/**
 * IN-306: how often the heap watchdog reads a running worker's heap. Measured on the Linux host (2026-10-12): a one-page
 * PDF peaks at about 12 MB of heap in use and the 300-page probe PDF at about 115 MB, growing over two seconds, so a 10 ms
 * read stops an overrun long before it doubles. A read waits for the previous one, so slow reads never pile up.
 */
export const HEAP_WATCH_INTERVAL_MS = 10;

/** The part of Node 24's `Worker.getHeapStatistics()` the watchdog reads; the installed Node typings predate it. */
interface WorkerHeapReader {
  getHeapStatistics?(): Promise<{ readonly used_heap_size: number }>;
}

/**
 * WR-204 (the pilot's ruling): how many tasks may wait behind the running one in the one screening and extraction queue.
 * Probes and extractions share it, because separate slots would double the worst-case worker memory (768 MB each).
 * Four keeps room for several people adding files, or including them for the AI, at once (an uploader has at most one
 * screening in flight), while bounding what a full queue costs: the last waiting task starts after at most four others,
 * so it waits at most four PDF open checks (40 s) or four extractions (120 s), and the waiting tasks hold at most four
 * files' bytes (100 MiB). Anything beyond it is refused at once and may be retried.
 */
export const EXTRACTION_QUEUE_MAX_WAITING = 4;

/** The queue is full (WR-204): the caller answers ATTACHMENT_BUSY (503, retryable). It carries nothing of the file. */
export class ExtractionBusyError extends Error {
  readonly code = "EXTRACTION_BUSY";

  constructor() {
    super("CSRM's file screening and extraction queue is full.");
    this.name = "ExtractionBusyError";
  }
}

let queueTail: Promise<unknown> = Promise.resolve();

/** Tasks admitted and not yet settled: the running one and those waiting behind it. */
let admitted = 0;

/**
 * Runs `task` after every earlier task has settled: one worker at a time. With the running task and
 * EXTRACTION_QUEUE_MAX_WAITING waiting, it is refused at once with ExtractionBusyError instead of waiting. A task frees
 * its place when it settles, fulfilled or rejected. Exported for the queue's tests and the mounted harness, which fill
 * it; production code goes through probePdf and extractAttachmentText.
 */
export function runExclusively<T>(task: () => Promise<T>): Promise<T> {
  if (admitted > EXTRACTION_QUEUE_MAX_WAITING) return Promise.reject(new ExtractionBusyError());
  admitted += 1;
  const run = queueTail.then(task, task);
  const done = (): void => {
    admitted -= 1;
  };
  queueTail = run.then(done, done);
  return run;
}

/** A fresh ArrayBuffer holding exactly `bytes`, so transferring it never detaches the caller's buffer or a pooled one. */
function ownedCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isReply(value: unknown): value is ExtractionReply {
  if (typeof value !== "object" || value === null) return false;
  const reply = value as Record<string, unknown>;
  if (reply.ok === false) return typeof reply.code === "string";
  if (reply.ok !== true) return false;
  if ("kind" in reply) return reply.kind === "ok" || reply.kind === "password" || reply.kind === "invalid";
  return typeof reply.text === "string" && Number.isSafeInteger(reply.available);
}

/**
 * Runs one worker and settles only after it has exited: with its reply, or with null on a timeout, a heap overrun,
 * a crash or an unexpected message.
 */
function runWorker(request: ExtractionRequest, timeoutMs: number, heapMb: number, observer: ExtractionObserver): Promise<ExtractionReply | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(WORKER_PATH, {
        workerData: request,
        transferList: [request.bytes],
        // WR-202: an empty environment and no Node flags, so a parser bug never reaches Strapi's secrets.
        env: {},
        execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: heapMb },
        stdout: true,
        stderr: true,
      });
    } catch {
      resolve(null);
      return;
    }
    observer.onWorkerStart?.();
    worker.stdout.resume();
    worker.stderr.resume();

    let reply: ExtractionReply | null = null;
    let failed = false;
    let exited = false;
    const stop = (): void => {
      void worker.terminate().catch(() => undefined);
    };
    const timer = setTimeout(() => {
      failed = true;
      stop();
    }, timeoutMs);

    // IN-306: the heap watchdog. Over the limit is the same answer as V8's own overrun: terminated, then null.
    const heapLimitBytes = heapMb * 1024 * 1024;
    const readHeap = (worker as Worker & WorkerHeapReader).getHeapStatistics?.bind(worker);
    let watch: NodeJS.Timeout | undefined;
    const watchHeap = (read: () => Promise<{ readonly used_heap_size: number }>): void => {
      watch = setTimeout(() => {
        watch = undefined;
        read().then(
          (heap) => {
            if (exited) return;
            if (heap.used_heap_size > heapLimitBytes) {
              failed = true;
              stop();
            } else watchHeap(read);
          },
          // A read the worker could not answer: keep watching until it exits.
          () => {
            if (!exited) watchHeap(read);
          },
        );
      }, HEAP_WATCH_INTERVAL_MS);
    };
    if (readHeap !== undefined) watchHeap(readHeap);

    worker.on("message", (message: unknown) => {
      if (!failed && reply === null && isReply(message)) reply = message;
      else failed = true;
      stop();
    });
    worker.on("messageerror", () => {
      failed = true;
      stop();
    });
    worker.on("error", () => {
      failed = true;
    });
    worker.once("exit", () => {
      exited = true;
      clearTimeout(timer);
      clearTimeout(watch);
      observer.onWorkerExit?.();
      resolve(failed ? null : reply);
    });
  });
}

/**
 * The PDF open check (D-09): `password` when pdf.js needs a password, `invalid` when it cannot open the file, times
 * out or the worker fails, else `ok`. It rejects with ExtractionBusyError when the queue is full (WR-204).
 */
export function probePdf(bytes: Uint8Array, limits: ExtractionLimits = EXTRACTION_LIMITS): Promise<PdfProbe> {
  return runExclusively(async () => {
    const reply = await runWorker({ op: "probe-pdf", bytes: ownedCopy(bytes) }, limits.pdfProbeMs, limits.heapMb, {});
    return reply !== null && reply.ok && "kind" in reply ? reply.kind : "invalid";
  });
}

/**
 * A text-bearing file's text, normalised and capped (D-31, D-33), or ATTACHMENT_TEXT_UNAVAILABLE. Text that is empty
 * or only whitespace after normalisation is unavailable. It rejects with ExtractionBusyError when the queue is full
 * (WR-204).
 */
export function extractAttachmentText(
  input: { readonly type: TextBearingType; readonly bytes: Uint8Array; readonly cap?: number },
  limits: ExtractionLimits = EXTRACTION_LIMITS,
  observer: ExtractionObserver = {},
): Promise<ExtractedText | TextUnavailable> {
  const cap = input.cap ?? EXTRACTION_TEXT_CAP;
  if (!Number.isSafeInteger(cap) || cap < 1) throw new RangeError("cap must be a positive integer");
  if (!TEXT_BEARING_TYPES.includes(input.type)) throw new TypeError(`${String(input.type)} is not a text-bearing type`);

  return runExclusively(async () => {
    const reply = await runWorker({ op: "extract", type: input.type, bytes: ownedCopy(input.bytes), cap }, limits.wallClockMs, limits.heapMb, observer);
    if (reply === null || !reply.ok || !("text" in reply)) return UNAVAILABLE;
    const { text, available } = reply;
    if (text.length > cap || available < text.length || !/\S/.test(text)) return UNAVAILABLE;
    return { ok: true, text, available, kept: text.length, truncated: available > text.length, extractor: EXTRACTOR_VERSION };
  });
}
