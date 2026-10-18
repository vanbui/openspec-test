#!/bin/bash
# Offline renderer checks. Fixtures contain only deliberately fake values.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'chmod u+r "${work}/unreadable.xml" 2>/dev/null || true; rm -rf "${work}"' EXIT
failures=0
check() {
  if [ "$2" = 0 ]; then echo "PASS $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}
# Constructed from repeated characters: never an issued credential.
fake="idb_scim_v1.$(printf 'fake%020d' 0).$(printf '%043d' 0)"
export MIDPOINT_SCIM_TOKEN="${fake}"
render="${HERE}/../render.sh"
printf '<resource>unchanged &amp; literal</resource>\n\n' >"${work}/plain.xml"
printf '<resource>@@MIDPOINT_SCIM_TOKEN@@/@@MIDPOINT_SCIM_TOKEN@@</resource>\n' >"${work}/token.xml"
printf '<resource>%s/%s</resource>\n' "${fake}" "${fake}" >"${work}/expected.xml"

success() {
  local rc=0
  sh "${render}" "$2" >"${work}/out" 2>"${work}/err" || rc=$?
  check "$1: succeeds" "${rc}"
  rc=0; cmp -s "$3" "${work}/out" || rc=$?
  check "$1: exact output" "${rc}"
  rc=0; if grep -q -F -e "${fake}" "${work}/err"; then rc=1; fi
  check "$1: no token on stderr" "${rc}"
}
refused() {
  local rc=0
  if sh "${render}" "$2" >"${work}/out" 2>"${work}/err"; then rc=1; fi
  check "$1: refused" "${rc}"
  rc=0; [ ! -s "${work}/out" ] || rc=1
  check "$1: no stdout" "${rc}"
  rc=0
  if grep -q -F -e "${fake}" "${work}/err"; then rc=1; fi
  if [ -n "${MIDPOINT_SCIM_TOKEN:-}" ] && grep -q -F -e "${MIDPOINT_SCIM_TOKEN}" "${work}/err"; then rc=1; fi
  check "$1: no token on stderr" "${rc}"
}
success 'no placeholders' "${work}/plain.xml" "${work}/plain.xml"
success 'valid fake token' "${work}/token.xml" "${work}/expected.xml"
unset MIDPOINT_SCIM_TOKEN
refused 'missing token' "${work}/token.xml"
export MIDPOINT_SCIM_TOKEN=''
refused 'empty token' "${work}/token.xml"
export MIDPOINT_SCIM_TOKEN='   '
refused 'blank token' "${work}/token.xml"
for malformed in 'fake-malformed-token' "${fake}x" "${fake}"$'\nextra' 'idb_scim_v1.short.short'; do
  export MIDPOINT_SCIM_TOKEN="${malformed}"
  refused 'malformed token' "${work}/token.xml"
done
export MIDPOINT_SCIM_TOKEN="${fake}"
for placeholder in '@@OTHER@@' '@@NAME_123@@' '@@MIDPOINT_SCIM_TOKEN_OTHER@@'; do
  printf '<resource>@@MIDPOINT_SCIM_TOKEN@@%s</resource>\n' "${placeholder}" >"${work}/other.xml"
  refused 'unsupported placeholder' "${work}/other.xml"
done
refused 'absent file' "${work}/absent.xml"
refused 'directory' "${work}"
cp "${work}/plain.xml" "${work}/unreadable.xml"
chmod 000 "${work}/unreadable.xml"
refused 'unreadable file' "${work}/unreadable.xml"
[ "${failures}" = 0 ] && echo 'ALL PASS' || { echo "${failures} FAILED"; exit 1; }
