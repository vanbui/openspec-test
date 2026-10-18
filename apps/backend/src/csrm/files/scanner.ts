import type { AttachmentScannerConfig } from "./attachment-config";
import { createClamavScanner, type ClamdConnect } from "./clamav-scanner";

/*
 * The malware scanner port (14-03; D-12, D-14). Screening asks one scanner for a verdict. A scanner that cannot give
 * one answers `not-scanned` with its cause, never `clean`, so an unavailable engine fails closed (G-7).
 *
 * The development double is deterministic. It flags the CSRM test signature, which the suites use, and the EICAR test
 * string, which no file in the repository spells: the module stores its 68 bytes XOR 0x5A as hex and decodes them at
 * load, so neither this source nor its compiled output holds the string a host's antivirus would quarantine
 * (14-RESEARCH Pitfall 7). The double is allowed only under the development key; the configuration fails boot
 * anywhere else (attachment-config.ts).
 */

export type ScanVerdict =
  | { readonly kind: "clean"; readonly engine: string }
  | { readonly kind: "infected"; readonly engine: string; readonly detection: string }
  | { readonly kind: "not-scanned"; readonly engine: string; readonly cause: "unavailable" | "timeout" | "limits" | "error" };

export interface MalwareScanner {
  readonly name: string;
  scan(bytes: Uint8Array, signal?: AbortSignal): Promise<ScanVerdict>;
}

/** The harmless signature the automated suites use in place of a real test string (D-14). */
export const CSRM_TEST_MALWARE_SIGNATURE = "CSRM-TEST-MALWARE-SIGNATURE-7c1e4a";

/** The EICAR test string's 68 bytes, each XOR 0x5A, as hex. Decoded only in memory. */
export const EICAR_XOR_5A_HEX =
  "026f157b0a7f1a1b0a016e060a00026f6e720a04736d1919736d277e1f13191b0877090e1b141e1b081e771b140e130c13080f09770e1f090e771c13161f7b7e12711270";

const DEVELOPMENT_SCANNER_NAME = "csrm-development-double/1";

const SIGNATURES: ReadonlyArray<{ readonly bytes: Buffer; readonly detection: string }> = [
  { bytes: Buffer.from(Buffer.from(EICAR_XOR_5A_HEX, "hex").map((byte) => byte ^ 0x5a)), detection: "Eicar-Test-Signature" },
  { bytes: Buffer.from(CSRM_TEST_MALWARE_SIGNATURE, "latin1"), detection: "Csrm.Test.Signature" },
];

function view(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The development double: flags the EICAR test string or the CSRM test signature anywhere in the bytes. */
export function createDevelopmentScanner(): MalwareScanner {
  return {
    name: DEVELOPMENT_SCANNER_NAME,
    async scan(bytes: Uint8Array): Promise<ScanVerdict> {
      const buffer = view(bytes);
      for (const signature of SIGNATURES) {
        if (buffer.indexOf(signature.bytes) !== -1) return { kind: "infected", engine: DEVELOPMENT_SCANNER_NAME, detection: signature.detection };
      }
      return { kind: "clean", engine: DEVELOPMENT_SCANNER_NAME };
    },
  };
}

/**
 * The scanner the attachment configuration selects (D-15): the double, the ClamAV adapter, or none when scanning is
 * not configured (attachments are then unavailable). The configuration has already refused the double outside the
 * development key at boot.
 */
export function selectMalwareScanner(config: AttachmentScannerConfig | null, options: { readonly connect?: ClamdConnect } = {}): MalwareScanner | null {
  if (config === null) return null;
  if (config.kind === "development") return createDevelopmentScanner();
  return createClamavScanner({ host: config.host, port: config.port, timeoutMs: config.timeoutMs, connect: options.connect });
}
