#!/bin/bash
# One-shot midpoint_init service: prepares midPoint's home and repository before
# midpoint_server starts. Runs on every `docker compose up`, and is safe to repeat.
#
# 1. Create config.xml in the home volume (midpoint.sh init-native) if absent.
# 2. Create the native repository and audit schemas when they are absent, and
#    refuse a database that holds only part of them.
# 3. Replace the SCIM2 connector bundle in var/connid-connectors with the one
#    built into this image, so a reused home volume always runs the image's bundle.
# 4. Until it has once succeeded, seed the numbered objects from
#    docker/midpoint/objects (mounted read-only) as post-initial objects,
#    rendered with the Identity Source token (render.sh). Later changes are
#    applied with docker/midpoint/reload.sh or reload.ps1.
# 5. Seed the live HR CSV (var/hr/hr.csv) from docker/midpoint/hr if absent.
# 6. Install the IdamBox user schema extension (docker/midpoint/schema).
#
# Needs PGHOST, PGDATABASE, PGUSER and PGPASSWORD for the schema probes, and the
# MP_SET_midpoint_repository_* settings for midPoint and Ninja (docker-compose.yaml).
set -eu

MP=/opt/midpoint
HOME_DIR="${MP}/var"
SEEDED_MARKER="${HOME_DIR}/.idambox-objects-seeded"
# Ninja resolves the bundled SQL scripts relative to the install directory.
cd "${MP}"

fail() {
  echo "[idambox-init] $*" >&2
  exit 1
}

# Counts how many of the named tables exist. A connection or authentication
# failure stops the script (ON_ERROR_STOP and set -e), so it is never read as
# "absent".
count_tables() {
  local list
  list="$(printf "'%s'," "$@")"
  psql -v ON_ERROR_STOP=1 -Atqc \
    "select count(*) from information_schema.tables where table_schema = current_schema() and table_name in (${list%,})"
}

# Required tables of the native repository and audit schemas (postgres.sql,
# postgres-audit.sql in /opt/midpoint/doc/config/sql/native).
REPO_TABLES=(m_global_metadata m_object m_user m_resource m_task)
AUDIT_TABLES=(ma_audit_event ma_audit_delta ma_audit_ref)

echo "[idambox-init] preparing midPoint home"
"${MP}/bin/midpoint.sh" init-native

repo="$(count_tables "${REPO_TABLES[@]}")" || fail "cannot query the repository database"
audit="$(count_tables "${AUDIT_TABLES[@]}")" || fail "cannot query the repository database"

if [ "${repo}" = 0 ]; then
  [ "${audit}" = 0 ] || fail "audit tables exist without the repository schema; reset midPoint (docker/README.md, Reset)"
  echo "[idambox-init] creating repository schema"
  "${MP}/bin/ninja.sh" -B run-sql --create --mode REPOSITORY
elif [ "${repo}" != "${#REPO_TABLES[@]}" ]; then
  fail "the repository schema is incomplete (${repo} of ${#REPO_TABLES[@]} required tables); reset midPoint (docker/README.md, Reset)"
else
  echo "[idambox-init] repository schema present"
fi

if [ "${audit}" = 0 ]; then
  # Also recovers a first run that stopped between the two scripts.
  echo "[idambox-init] creating audit schema"
  "${MP}/bin/ninja.sh" -B run-sql --create --mode AUDIT
elif [ "${audit}" != "${#AUDIT_TABLES[@]}" ]; then
  fail "the audit schema is incomplete (${audit} of ${#AUDIT_TABLES[@]} required tables); reset midPoint (docker/README.md, Reset)"
else
  echo "[idambox-init] audit schema present"
fi

# Fail closed: both schemas complete, and midPoint's own repository check passes.
[ "$(count_tables "${REPO_TABLES[@]}")" = "${#REPO_TABLES[@]}" ] || fail "repository schema check failed"
[ "$(count_tables "${AUDIT_TABLES[@]}")" = "${#AUDIT_TABLES[@]}" ] || fail "audit schema check failed"
psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from ma_audit_event" >/dev/null || fail "audit table query failed"
if ! "${MP}/bin/ninja.sh" -B info >/tmp/ninja-info.log 2>&1 || grep -q "ERROR" /tmp/ninja-info.log; then
  cat /tmp/ninja-info.log >&2
  fail "midPoint repository check failed"
fi

echo "[idambox-init] installing SCIM2 connector bundle"
mkdir -p "${HOME_DIR}/connid-connectors"
rm -f "${HOME_DIR}"/connid-connectors/connector-scim2-*.jar
cp "${MP}"/connector-bundle/connector-scim2-*.jar "${HOME_DIR}/connid-connectors/"

echo "[idambox-init] installing the IdamBox schema extension"
mkdir -p "${HOME_DIR}/schema"
cp /opt/midpoint/schema-src/idambox-extension.xsd "${HOME_DIR}/schema/"

# A home volume from before the marker existed already holds its seeded objects.
if [ ! -e "${SEEDED_MARKER}" ] && ls "${HOME_DIR}"/post-initial-objects/*.xml* >/dev/null 2>&1; then
  touch "${SEEDED_MARKER}"
fi
# midPoint renames imported post-initial objects to *.done. They are never read
# again, and a rendered one holds the Identity Source token in clear, so remove them.
rm -f "${HOME_DIR}"/post-initial-objects/*.done

if [ ! -e "${SEEDED_MARKER}" ]; then
  echo "[idambox-init] seeding numbered objects as post-initial objects"
  mkdir -p "${HOME_DIR}/post-initial-objects"
  chmod 0700 "${HOME_DIR}/post-initial-objects"
  for f in /opt/midpoint/objects-src/[0-9][0-9][0-9]-*.xml; do
    [ -e "${f}" ] || continue
    out="${HOME_DIR}/post-initial-objects/$(basename "${f}")"
    # render.sh substitutes the Identity Source token; an object it cannot render
    # (no token issued yet) is skipped, and reload.sh applies it once the token exists.
    if ! (umask 077 && /opt/midpoint/bin/idambox-render.sh "${f}" >"${out}"); then
      rm -f "${out}"
      echo "[idambox-init] WARNING: $(basename "${f}") not seeded; issue the SCIM token, recreate the midpoint containers and run docker/midpoint/reload.sh (docker/README.md)" >&2
    fi
  done
  touch "${SEEDED_MARKER}"
fi

# The live Identity Source file. Seeded once from the committed reference CSV
# (mounted read-only); replace it with docker/midpoint/hr-publish.sh.
mkdir -p "${HOME_DIR}/hr"
if [ ! -e "${HOME_DIR}/hr/hr.csv" ]; then
  echo "[idambox-init] seeding the HR CSV from docker/midpoint/hr/reference.csv"
  cp /opt/midpoint/hr-src/reference.csv "${HOME_DIR}/hr/hr.csv"
fi

echo "[idambox-init] done"
