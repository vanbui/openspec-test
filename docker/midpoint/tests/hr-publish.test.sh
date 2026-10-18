#!/bin/bash
# Offline publication checks: docker is replaced with a recording executable.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
failures=0
check() {
  if [ "$2" = 0 ]; then echo "PASS $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}
mkdir -p "${work}/bin"
cat >"${work}/bin/docker" <<'STUB'
#!/bin/bash
set -eu
printf '%s\n' "$@" >>"${RECORD_DIR}/calls"
cat >"${RECORD_DIR}/stdin"
STUB
chmod +x "${work}/bin/docker"
export PATH="${work}/bin:${PATH}" RECORD_DIR="${work}"
printf 'wrong,header\n000001,fictitious\n' >"${work}/wrong.csv"
rc=0
if bash "${HERE}/../hr-publish.sh" "${work}/wrong.csv" >"${work}/out" 2>"${work}/err"; then rc=1; fi
check 'wrong header refused' "${rc}"
rc=0; [ ! -e "${work}/calls" ] || rc=1
check 'wrong header makes no docker call' "${rc}"
# A snapshot the CSV connector would misread is refused whole, before any docker call:
# a duplicate key would silently replace a person.
header="$(head -n 1 "${HERE}/../hr/reference.csv")"
refuse() {
  local label="$1" body="$2"
  printf '%s\n%s\n' "${header}" "${body}" >"${work}/bad.csv"
  rc=0
  if bash "${HERE}/../hr-publish.sh" "${work}/bad.csv" >"${work}/out" 2>"${work}/err"; then rc=1; fi
  [ ! -e "${work}/calls" ] || rc=1
  check "${label} refused with no docker call" "${rc}"
}
refuse 'duplicate employeeNumber' $'000001,A,B,,a@hr.idambox.test,a,X,Y,active,,\n000001,C,D,,c@hr.idambox.test,c,X,Y,terminated,,'
refuse 'case-only duplicate email' $'000001,A,B,,a@hr.idambox.test,a,X,Y,active,,\n000002,C,D,,A@HR.idambox.test,c,X,Y,active,,'
refuse 'empty employeeNumber' $',A,B,,a@hr.idambox.test,a,X,Y,active,,'
refuse 'wrong field count' $'000001,A,B,,a@hr.idambox.test,a,X,Y,active'
# Include CRLF, UTF-8 and CSV quoting; header acceptance must not rewrite bytes.
python3 - "${HERE}/../hr/reference.csv" "${work}/correct.csv" <<'PY'
from pathlib import Path
import sys
Path(sys.argv[2]).write_bytes(Path(sys.argv[1]).read_bytes().replace(b'\n', b'\r\n'))
PY
rc=0
bash "${HERE}/../hr-publish.sh" "${work}/correct.csv" >"${work}/out" 2>"${work}/err" || rc=$?
check 'correct header accepted' "${rc}"
printf '%s\n' exec -i midpoint sh -c 'set -eu; umask 022; tmp=/opt/midpoint/var/hr/.hr.csv.publishing; cat > "$tmp"; mv -f "$tmp" /opt/midpoint/var/hr/hr.csv' >"${work}/expected-calls"
rc=0; cmp -s "${work}/expected-calls" "${work}/calls" || rc=$?
check 'one container-local atomic publication through docker exec -i midpoint' "${rc}"
rc=0; cmp -s "${work}/correct.csv" "${work}/stdin" || rc=$?
check 'CSV streamed unchanged' "${rc}"
[ "${failures}" = 0 ] && echo 'ALL PASS' || { echo "${failures} FAILED"; exit 1; }
