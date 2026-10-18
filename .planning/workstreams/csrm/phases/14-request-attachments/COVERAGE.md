# API Coverage — Phase 14 request attachments

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 14 integrates two external surfaces, both inside Strapi and both behind CSRM's own ports, so no CSRM route, web module or test reaches them directly:

- **`clamd`'s protocol**, through the ClamAV adapter (`apps/backend/src/csrm/files/clamav-scanner.ts`, Node's own `net`, no package) behind the scanner port (`scanner.ts`). Proven against the fake `clamd` server (`apps/backend/tests/helpers/fake-clamd-server.ts`) in `attachment-scanner.unit.test.ts`, `request-attachments-scanning.integration.test.ts` and `attachment-quarantine.integration.test.ts`. Reference: docs.clamav.net, "Clamd Protocol".
- **`@strapi/provider-upload-aws-s3` 5.51.0**, through the storage port (`apps/backend/src/csrm/files/storage-port.ts`) and its registration (`register-attachment-storage.ts`). Proven against a fake object store in `attachment-storage-s3.integration.test.ts` and `attachment-storage.unit.test.ts`; no AWS endpoint is contacted by any suite.

The CSRM attachment routes themselves are Strapi OpenAPI operations, covered by the contract, the served-operations inventory and the authorization matrix (14-06 to 14-09), not here.

# API Coverage — clamd

`clamd`'s commands, as its protocol documents them. Each command is sent in the NUL-terminated `z` form.

| capability | decision | reason |
|---|---|---|
| INSTREAM | INTEGRATE | |
| VERSION | INTEGRATE | |
| PING | OPT-OUT | Availability is learnt from INSTREAM itself, which fails closed: a refused connection, a timeout, a reset or an error reply leaves the file quarantined and re-scanned. A separate liveness probe would add a round trip and could pass while the scan still fails. |
| SCAN | OPT-OUT | It scans a path on the `clamd` host. Attachment bytes are screened in Strapi's memory and never written to `clamd`'s disk. |
| CONTSCAN | OPT-OUT | It scans a path on the `clamd` host. Attachment bytes are screened in Strapi's memory and never written to `clamd`'s disk. |
| MULTISCAN | OPT-OUT | It scans a path on the `clamd` host, in parallel. Attachment bytes are screened in Strapi's memory and never written to `clamd`'s disk. |
| ALLMATCHSCAN | OPT-OUT | It scans a path on the `clamd` host and reports every match. Attachment bytes never touch `clamd`'s disk, and one detection is enough to refuse or block a file. |
| FILDES | OPT-OUT | It passes a file descriptor over a Unix socket. The adapter connects over TCP, because `clamd` runs on the deployment's network, never on the Strapi host. |
| IDSESSION | OPT-OUT | A session multiplexes several commands on one connection. One scan per connection is enough at this volume (one file at a time per person, at most 25 MiB), and a fresh connection per scan keeps failures isolated. |
| END | OPT-OUT | It closes an IDSESSION session, which the adapter does not open. |
| STATS | OPT-OUT | It reports the daemon's queue and memory. Monitoring `clamd` is the deployment's work, not the application's. |
| RELOAD | OPT-OUT | It reloads the signature database. That is an operator command, done by `freshclam`, never by the application. |
| SHUTDOWN | OPT-OUT | It stops the daemon. That is an operator command, never the application's. |
| VERSIONCOMMANDS | OPT-OUT | It lists the commands the daemon supports. The adapter uses only INSTREAM and VERSION, which every supported `clamd` release serves, so it has nothing to negotiate. |

# API Coverage — @strapi/provider-upload-aws-s3

The provider's methods, as version 5.51.0 exports them (`dist/index.js`). CSRM configures it private: no ACL header, SSE-KMS with the configured key, objects under `csrm/attachments/`, 60-second presigned reads and no `baseUrl` (`apps/backend/README.md`, "Production storage: a private S3 bucket").

| capability | decision | reason |
|---|---|---|
| upload | INTEGRATE | |
| delete | INTEGRATE | |
| getSignedUrl | INTEGRATE | |
| uploadStream | OPT-OUT | Every file is screened in memory (type, size, content, SHA-256 and the malware scan) before it is stored, so its bytes and size are known, and `upload` with a buffer sends exactly the scanned bytes. |
| isPrivate | OPT-OUT | CSRM never relies on it. With the ACL omitted it answers false, yet the bucket's Block Public Access and Object Ownership refuse every anonymous read, and CSRM reads only through presigned URLs it never returns. |
| getObjectMetadata | OPT-OUT | CSRM keeps its own SHA-256 and size on the attachment record and checks the digest of every read before any byte is sent, so the object's metadata adds nothing. |
| objectExists | OPT-OUT | A missing object surfaces when it is read: the download answers 409 `ATTACHMENT_UNAVAILABLE` and the list shows `File unavailable`. A separate existence check would be a second round trip with the same outcome. |
| checkFileSize | OPT-OUT | CSRM enforces its own 25 MiB (26,214,400-byte) limit before the bytes are read and again after screening, with its own closed refusal. |

`getSignedUrl` is used for server-side reads only: Strapi fetches the presigned `GetObject` URL itself, refuses one without a signature, follows no redirect and accepts at most 25 MiB, and the URL never leaves the storage port.
