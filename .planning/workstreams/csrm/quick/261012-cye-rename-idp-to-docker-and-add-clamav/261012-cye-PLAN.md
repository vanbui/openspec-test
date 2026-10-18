---
quick_id: 261012-cye
mode: quick
---

Rename idp to docker and add ClamAV.

1. Move the local container setup to docker/docker-compose.yaml; update current documentation, scripts and the fixture test to use the new paths.
2. Add clamav/clamav:stable with container name clamav, 127.0.0.1:3310:3310 and the clamav-db volume mounted at /var/lib/clamav. Preserve the existing Keycloak Compose project identity so its persisted realm remains available after the rename.
3. Validate the resolved Compose configuration and run the focused Keycloak fixture test. Commit the changes, then record completion in the CSRM workstream state and summary.

Execution: inline under the skill's Codex spawn restriction. No application workflow or API contract changes.
