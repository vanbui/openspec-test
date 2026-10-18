#!/bin/bash
# Re-applies midPoint configuration from docker/midpoint/objects/ to the running
# midPoint (post-initial objects load only once, when the repository is created).
#
#   docker/midpoint/reload.sh                      # every numbered object, in order
#   docker/midpoint/reload.sh 110-resource-x.xml   # just the named object(s)
#
# Each object is PUT through midPoint's REST API (create or overwrite by OID), so
# the change goes through midPoint's model and caches instead of behind its back.
# The call runs inside the midpoint container: the administrator password never
# reaches the terminal. Stops at the first failure with a non-zero exit code.
set -eu
# Git Bash on Windows would otherwise rewrite container paths into Windows paths.
export MSYS_NO_PATHCONV=1

OBJECTS_DIR="$(cd "$(dirname "$0")/objects" && pwd)"

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  files=()
  for f in "${OBJECTS_DIR}"/[0-9][0-9][0-9]-*.xml; do
    [ -e "${f}" ] && files+=("$(basename "${f}")")
  done
fi

# REST collection for each object root element used in docker/midpoint/objects.
collection_for() {
  case "$1" in
    resource) echo resources ;;
    user) echo users ;;
    role) echo roles ;;
    archetype) echo archetypes ;;
    objectTemplate) echo objectTemplates ;;
    task) echo tasks ;;
    systemConfiguration) echo systemConfigurations ;;
    securityPolicy) echo securityPolicies ;;
    valuePolicy) echo valuePolicies ;;
    orgType | org) echo orgs ;;
    objectCollection) echo objectCollections ;;
    *) return 1 ;;
  esac
}

for name in "${files[@]}"; do
  src="${OBJECTS_DIR}/${name}"
  if [ ! -f "${src}" ]; then
    echo "reload: no such object file: ${name}" >&2
    exit 1
  fi
  # Root element and OID of the object (skipping the XML declaration and comments).
  header="$(tr '\n' ' ' <"${src}" | sed -e 's/<?[^?]*?>//g' -e 's/<!--[^>]*-->//g' | grep -o '<[A-Za-z][^ >]*[^>]*>' | head -1)"
  root="$(printf '%s' "${header}" | sed -e 's/^<\([A-Za-z:]*\).*/\1/' -e 's/.*://')"
  oid="$(printf '%s' "${header}" | grep -o 'oid="[^"]*"' | head -1 | cut -d'"' -f2)"
  if [ -z "${oid}" ]; then
    echo "reload: ${name}: the root element needs a fixed oid attribute" >&2
    exit 1
  fi
  if ! collection="$(collection_for "${root}")"; then
    echo "reload: ${name}: unsupported object type <${root}>; add it to collection_for" >&2
    exit 1
  fi

  # Same single-quote-only container script as reload.ps1; set -f and an empty IFS
  # stop the unquoted expansions from splitting or globbing.
  # The object is rendered inside the container (docker/midpoint/render.sh), so the
  # Identity Source token never reaches the terminal; a failed render sends nothing.
  code="$(docker exec midpoint sh -c "set -f; IFS=; body=\$(/opt/midpoint/bin/idambox-render.sh /opt/midpoint/objects-src/\$0) || { echo render; exit 0; }; printf '%s' \"\$body\" | curl -sS -o /tmp/reload-response -w '%{http_code}' -X PUT -u administrator:\$MP_SET_midpoint_administrator_initialPassword -H 'Content-Type: application/xml' -H 'Accept: application/json' --data-binary @- http://localhost:8080/midpoint/ws/rest/\$1/\$2" "${name}" "${collection}" "${oid}")"
  if [ "${code}" = render ]; then
    echo "reload: ${name} not sent: it could not be rendered (see above)" >&2
    exit 1
  fi
  case "${code}" in
    200 | 201 | 202 | 204)
      echo "reloaded ${name} (${root} ${oid}): HTTP ${code}" ;;
    *)
      echo "reload: ${name} failed: HTTP ${code}" >&2
      docker exec midpoint sh -c "grep -o '.message. *: *.[^,]*' /tmp/reload-response | head -3" >&2 || true
      exit 1 ;;
  esac
done
