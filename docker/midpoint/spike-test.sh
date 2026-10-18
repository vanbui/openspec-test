#!/bin/bash
# Phase 1 go/no-go check for the SCIM2 connector on midPoint 4.8.
#
# Needs the stack running with the spike profile:
#   docker compose --profile scim-spike up -d        (from docker/)
#   docker/midpoint/spike-test.sh
#
# Calls midPoint's REST API from inside the midpoint container, so the
# administrator password never leaves the container or reaches the terminal.
# Exits 0 on "go": exactly one SCIM2 connector 1.2.9 is listed, the spike
# resource's connection test succeeds, and the stub logged the connector's
# GET /scim/v2/ResourceTypes during the test.
set -eu
# Git Bash on Windows would otherwise rewrite the REST paths into Windows paths.
export MSYS_NO_PATHCONV=1

DOCKER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCE_OID=11000000-0000-4000-8000-000000000001
CONNECTOR_TYPE=com.exclamationlabs.connid.base.scim2.Scim2Connector
CONNECTOR_VERSION=1.2.9

mp_rest() {
  # $1 = method, $2 = path under /midpoint/ws/rest
  docker exec midpoint sh -c \
    'curl -sS -X "$0" -u "administrator:${MP_SET_midpoint_administrator_initialPassword}" -H "Accept: application/json" "http://localhost:8080/midpoint/ws/rest$1"' \
    "$1" "$2"
}

echo "== image"
docker inspect -f '{{.Config.Image}}' midpoint

echo "== connectors of type ${CONNECTOR_TYPE}, version ${CONNECTOR_VERSION}"
# midPoint filters on type and version together, so only a connector object
# carrying both values is counted.
query="{\"query\":{\"filter\":{\"text\":\"connectorType = '${CONNECTOR_TYPE}' and connectorVersion = '${CONNECTOR_VERSION}'\"}}}"
connectors="$(printf '%s' "${query}" | docker exec -i midpoint sh -c   'curl -sS -X POST -u "administrator:${MP_SET_midpoint_administrator_initialPassword}" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary @- "http://localhost:8080/midpoint/ws/rest/connectors/search"')"
case "${connectors}" in
  *'"object"'*) count="$(printf '%s' "${connectors}" | grep -o "\"connectorVersion\" *: *\"${CONNECTOR_VERSION}\"" | wc -l | tr -d ' ')" ;;
  *) count=0; echo "unexpected connector search response" ;;
esac
echo "matching connectors: ${count}"

echo "== connection test of resource ${RESOURCE_OID}"
marker="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sleep 1
result="$(mp_rest POST "/resources/${RESOURCE_OID}/test")"
status="$(printf '%s' "${result}" | grep -o '"status" *: *"[a-z_]*"' | head -1 | sed 's/.*"\([a-z_]*\)"$/\1/')"
echo "top-level status: ${status:-<none>}"
printf '%s' "${result}" | grep -o '"operation" *: *"[^"]*"\|"status" *: *"[a-z_]*"' | paste - - 2>/dev/null | head -20 || true

echo "== stub requests since ${marker}"
stub_log="$(cd "${DOCKER_DIR}" && docker compose --profile scim-spike logs --no-log-prefix --since "${marker}" scim_stub 2>/dev/null | grep -E ' (GET|HEAD|POST|PUT|PATCH|DELETE) ' || true)"
printf '%s\n' "${stub_log}"

if [ "${count}" = "1" ] && [ "${status}" = "success" ] && printf '%s' "${stub_log}" | grep -q 'GET /scim/v2/ResourceTypes 200'; then
  echo "RESULT: GO"
else
  echo "RESULT: NO-GO"
  exit 1
fi
