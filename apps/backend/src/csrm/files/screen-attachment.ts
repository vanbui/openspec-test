import { createHash } from "node:crypto";

import { ATTACHMENT_LIMITS, sanitiseAttachmentName, type AttachmentRefusalReason, type AttachmentType } from "./attachment-policy";
import { checkAttachmentSignature, checkPdfOpens } from "./content-check";
import { probePdf as probePdfInWorker, type PdfProbe } from "./extraction";
import type { MalwareScanner, ScanVerdict } from "./scanner";

/*
 * The screening pipeline (14-03; D-09 to D-13). Phase 14's upload and Phase 20's evidence files share it. It decides
 * whether a file may be kept: the name, the size, the cheap content checks against the allow-list (signature, ZIP and
 * OOXML structure, the text rule), then the SHA-256 and the malware scan, and only then the PDF open check. It stores
 * nothing and logs nothing; the caller turns the result into a security event (D-37) and, for `not-scanned`, into a
 * quarantined file (D-13).
 *
 * WR-203 (the pilot's ruling): the PDF open check is a full pdf.js parse in the extraction worker, so it runs after the
 * scan, never on an infected file. When the scanner cannot answer, it still runs, in the worker with its empty
 * environment, before the file is stored pending: it is what refuses an encrypted PDF a scanner cannot see inside, and a
 * check that failed later would have to mark a stored PDF blocked, which reads as malware. That pre-scan parse during an
 * outage is part of the ISM-2059 outage residual (R-08-43).
 *
 * When the one screening and extraction queue is full, the open check rejects with ExtractionBusyError, which screening
 * passes on: the caller answers 503 ATTACHMENT_BUSY (WR-204).
 */

export type ScreenResult =
  | {
      readonly outcome: "clean";
      readonly name: string;
      readonly type: AttachmentType;
      readonly byteSize: number;
      readonly sha256: string;
      readonly engine: string;
    }
  | {
      readonly outcome: "not-scanned";
      readonly name: string;
      readonly type: AttachmentType;
      readonly byteSize: number;
      readonly sha256: string;
      readonly engine: string;
      readonly cause: Extract<ScanVerdict, { kind: "not-scanned" }>["cause"];
    }
  | {
      readonly outcome: "refused";
      readonly reason: AttachmentRefusalReason;
      readonly detection?: string;
      readonly engine?: string;
      readonly name?: string;
      readonly type?: AttachmentType;
      readonly byteSize: number;
      readonly sha256?: string;
    };

export interface ScreenDependencies {
  readonly scanner: MalwareScanner;
  /** The PDF open check; defaults to the extraction worker's. */
  readonly probePdf?: (bytes: Uint8Array) => Promise<PdfProbe>;
  readonly signal?: AbortSignal;
}

async function scanFailClosed(scanner: MalwareScanner, bytes: Uint8Array, signal: AbortSignal | undefined): Promise<ScanVerdict> {
  try {
    return await scanner.scan(bytes, signal);
  } catch {
    return { kind: "not-scanned", engine: scanner.name, cause: "error" };
  }
}

/** Screens one uploaded file. */
export async function screenAttachment(input: { readonly fileName: string; readonly bytes: Uint8Array }, dependencies: ScreenDependencies): Promise<ScreenResult> {
  const byteSize = input.bytes.byteLength;
  const name = sanitiseAttachmentName(input.fileName);
  if (name === null) return { outcome: "refused", reason: "ATTACHMENT_TYPE_NOT_ALLOWED", byteSize };
  if (byteSize === 0) return { outcome: "refused", reason: "ATTACHMENT_EMPTY", name, byteSize };
  if (byteSize > ATTACHMENT_LIMITS.maxBytes) return { outcome: "refused", reason: "ATTACHMENT_TOO_LARGE", name, byteSize };

  const content = checkAttachmentSignature({ fileName: name, bytes: input.bytes });
  if (!content.ok) return { outcome: "refused", reason: content.reason, name, byteSize };
  const type = content.type;

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const verdict = await scanFailClosed(dependencies.scanner, input.bytes, dependencies.signal);
  if (verdict.kind === "infected") {
    return { outcome: "refused", reason: "ATTACHMENT_MALWARE_FOUND", detection: verdict.detection, engine: verdict.engine, name, type, byteSize, sha256 };
  }
  if (type === "pdf") {
    const opened = await checkPdfOpens(input.bytes, dependencies.probePdf ?? probePdfInWorker);
    if (!opened.ok) return { outcome: "refused", reason: opened.reason, name, byteSize };
  }
  return verdict.kind === "clean"
    ? { outcome: "clean", name, type, byteSize, sha256, engine: verdict.engine }
    : { outcome: "not-scanned", name, type, byteSize, sha256, engine: verdict.engine, cause: verdict.cause };
}
