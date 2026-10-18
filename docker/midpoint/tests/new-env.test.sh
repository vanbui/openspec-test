#!/bin/bash
# Regression check for docker/midpoint/new-env.sh: with LF and with CRLF copies
# of docker/.env.example, every change-me value is replaced, no carriage return
# survives, every key is kept, and a refused run writes nothing. Works in a
# temporary directory and prints only PASS/FAIL lines, never a generated value.
#
#   docker/midpoint/tests/new-env.test.sh
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC_DOCKER="$(cd "${HERE}/../.." && pwd)"
failures=0

check() {
  # $1 = label, $2 = 0 when the check passed
  if [ "$2" = 0 ]; then echo "PASS $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}

run_case() {
  # $1 = label, $2 = "lf" or "crlf"
  local work out keys_in keys_out
  work="$(mktemp -d)"
  mkdir -p "${work}/docker/midpoint"
  cp "${SRC_DOCKER}/midpoint/new-env.sh" "${work}/docker/midpoint/"
  if [ "$2" = crlf ]; then
    sed 's/$/\r/' "${SRC_DOCKER}/.env.example" >"${work}/docker/.env.example"
  else
    cp "${SRC_DOCKER}/.env.example" "${work}/docker/.env.example"
  fi
  bash "${work}/docker/midpoint/new-env.sh" >/dev/null
  out="${work}/docker/.env"
  ! grep -q '=change-me' "${out}"; check "$1: no change-me placeholder left" $?
  ! grep -q $'\r' "${out}"; check "$1: no carriage return left" $?
  keys_in="$(tr -d '\r' <"${SRC_DOCKER}/.env.example" | grep -c '^[A-Z_]*=')"
  keys_out="$(grep -c '^[A-Z_]*=' "${out}")"
  [ "${keys_in}" = "${keys_out}" ]; check "$1: every key kept (${keys_out} of ${keys_in})" $?
  rm -rf "${work}"
}

run_case "LF example" lf
run_case "CRLF example" crlf

# A placeholder the generator cannot replace (here: one with trailing text) must
# stop it without leaving a file behind.
work="$(mktemp -d)"
mkdir -p "${work}/docker/midpoint"
cp "${SRC_DOCKER}/midpoint/new-env.sh" "${work}/docker/midpoint/"
printf 'A_PASSWORD=change-me-later\n' >"${work}/docker/.env.example"
if bash "${work}/docker/midpoint/new-env.sh" >/dev/null 2>&1; then rc=1; else rc=0; fi
check "unreplaceable placeholder is refused" "${rc}"
[ ! -e "${work}/docker/.env" ] && [ -z "$(ls -A "${work}/docker" | grep '^\.env\.new')" ]
check "refused run leaves no file" $?
rm -rf "${work}"

[ "${failures}" = 0 ] && echo "ALL PASS" || { echo "${failures} FAILED"; exit 1; }
