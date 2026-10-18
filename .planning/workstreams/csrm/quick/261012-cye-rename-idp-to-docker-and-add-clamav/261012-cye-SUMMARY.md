---
quick_id: 261012-cye
status: complete
commit: d32bb257
---

Moved idp/ to docker/ and renamed the Compose file to docker-compose.yaml. Updated active references in documentation, scripts, examples and the Keycloak fixture test. The realm import is byte-for-byte unchanged.

Added clamav/clamav:stable as container clamav, bound to 127.0.0.1:3310:3310 with the explicitly named clamav-db volume mounted at /var/lib/clamav. Kept the Compose project name idp to reuse the existing Keycloak volume. Documented startup and volume lifecycle.

Validation:
- Docker Compose config resolves successfully; assertions passed for the image, container name, loopback port, signature mount, exact volume name and existing Keycloak volume identity.
- Focused Keycloak fixture test passed (1/1) after emitting with noEmitOnError=false.
- Normal backend test compilation is blocked by missing unpdf and read-excel-file/universal dependencies and the resulting implicit-any error. No dependencies changed.
- Both legacy Keycloak static verifiers fail on existing root documentation expectations. Confirmed identical failures against HEAD before the task.
- git diff --check passed. Containers were not started.

GSD execution ran inline. The quick-tasks-append CLI hard-codes root STATE.md despite --ws; used its schema-backed appendQuickTaskRow helper with readModifyWriteStateMd on the CSRM state path. Phase 15 remains paused after 15-06.
