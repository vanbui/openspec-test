#!/bin/bash
# Creates docker/.env from docker/.env.example, replacing every "change-me" value
# with a fresh random secret. Prints no secret. Leaves an existing docker/.env
# alone unless --force is given (then reset the stack: docker compose down -v).
#
#   docker/midpoint/new-env.sh [--force]
set -eu

DOCKER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${DOCKER_DIR}/.env"
EXAMPLE="${DOCKER_DIR}/.env.example"

if [ -e "${TARGET}" ] && [ "${1:-}" != "--force" ]; then
  echo "docker/.env already exists; not changing it."
  exit 0
fi

secret() {
  # 14 characters with upper, lower and digit: midPoint's default password
  # policy allows at most 14.
  local s
  s="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 11)"
  printf 'Q%sz7%s' "${s:0:5}" "${s:5}"
}

umask 077
tmp="$(mktemp "${DOCKER_DIR}/.env.new.XXXXXX")"
trap 'rm -f "${tmp}"' EXIT

while IFS= read -r line || [ -n "${line}" ]; do
  # A Windows checkout may give the example CRLF line endings.
  line="${line%$'\r'}"
  case "${line}" in
    *=change-me) printf '%s=%s\n' "${line%%=*}" "$(secret)" ;;
    *) printf '%s\n' "${line}" ;;
  esac
done <"${EXAMPLE}" >"${tmp}"

if grep -q '=change-me' "${tmp}"; then
  echo "new-env: a change-me placeholder was not replaced; docker/.env not written" >&2
  exit 1
fi

mv -f "${tmp}" "${TARGET}"
trap - EXIT
echo "Created docker/.env with fresh local secrets."
